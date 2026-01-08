import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AddVoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    apiBase: string;
}

export function AddVoiceDialog({ open, onOpenChange, onSuccess, apiBase }: AddVoiceDialogProps) {
    const [name, setName] = useState("");
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!name.trim() || !file) {
            toast({
                title: "Missing fields",
                description: "Please provide a name and an audio file.",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);

        try {
            // v10: Step 1 - Get Presigned URL from RunPod
            const key = ""; // REMOVED_FOR_PUSH

            const urlResponse = await fetch(`${apiBase}/api/serverless`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                },
                body: JSON.stringify({
                    input: {
                        task: "generate_presigned_url",
                        filename: `${name.trim()}.wav`
                    }
                })
            });

            if (!urlResponse.ok) throw new Error("Failed to get upload permission");
            const urlData = await urlResponse.json();

            if (urlData.status !== "COMPLETED" || !urlData.output?.upload_url) {
                throw new Error(urlData.output?.error || "Server refused to generate upload URL");
            }

            const { upload_url, file_key } = urlData.output;

            // Step 2 - Upload direct to Cloudflare R2
            const uploadResponse = await fetch(upload_url, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type
                }
            });

            if (!uploadResponse.ok) {
                console.error("Upload failed:", await uploadResponse.text());
                throw new Error("Cloudflare upload failed (Check CORS settings)");
            }

            toast({
                title: "Voice Uploaded",
                description: `Voice "${name}" is now saved in Cloudflare R2.`,
            });

            onSuccess();
            onOpenChange(false);

            // Clear form
            setName("");
            setFile(null);

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Upload Failed",
                description: error.message || "Could not complete the upload.",
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
                <DialogHeader>
                    <DialogTitle>Add Reference Voice</DialogTitle>
                    <DialogDescription>
                        Upload a 10-30s audio sample and its transcription to clone a voice.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Voice Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. My Custom Voice"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-background border-border"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="text">Reference Text</Label>
                        <Textarea
                            id="text"
                            placeholder="The exact words spoken in the audio..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="bg-background border-border min-h-[100px]"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="audio">Audio File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="audio"
                                type="file"
                                accept="audio/*"
                                onChange={handleFileChange}
                                className="bg-background border-border flex-1 cursor-pointer"
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="w-full gap-2"
                    >
                        {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {isUploading ? "Uploading..." : "Save Voice"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
