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
            // v11: Helper to convert File to Base64 string
            const toBase64 = (file: File): Promise<string> =>
                new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => {
                        const base64String = (reader.result as string).split(',')[1];
                        resolve(base64String);
                    };
                    reader.onerror = (error) => reject(error);
                });

            const audioB64 = await toBase64(file);
            const key = "rpa_PLACEHOLDER_FOR_GITHUB"; // SANITIZED_FOR_PUSH

            // Step 1: Send Proxy Upload request to RunPod
            const response = await fetch(`${apiBase}/api/serverless`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${key}`
                },
                body: JSON.stringify({
                    input: {
                        task: "proxy_upload",
                        filename: `${name.trim()}.wav`,
                        audio_b64: audioB64,
                        text: text // The transcript text from the textarea
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to upload via proxy");
            }

            const data = await response.json();

            if (data.status !== "COMPLETED") {
                throw new Error(data.error || "Backend failed to process upload");
            }

            toast({
                title: "Voice Saved Successfully",
                description: `Voice "${name}" is now ready in your cloud library.`,
            });

            onSuccess();
            onOpenChange(false);

            // Clear form
            setName("");
            setText("");
            setFile(null);

        } catch (error: any) {
            console.error("Proxy Upload Error:", error);
            toast({
                title: "Upload Failed",
                description: error.message || "Could not complete the proxy upload.",
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
