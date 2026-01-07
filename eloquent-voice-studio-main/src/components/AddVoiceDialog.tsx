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
        if (!name.trim() || !text.trim() || !file) {
            toast({
                title: "Missing fields",
                description: "Please provide a name, reference text, and an audio file.",
                variant: "destructive",
            });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("id", name.trim());
        formData.append("text", text.trim());
        formData.append("audio", file);

        try {
            const response = await fetch(`${apiBase}/v1/references/add`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast({
                    title: "Voice Added",
                    description: `Voice "${name}" has been saved successfully.`,
                });
                onSuccess();
                onOpenChange(false);
                // Clear form
                setName("");
                setText("");
                setFile(null);
            } else {
                throw new Error(data.message || "Failed to upload voice");
            }
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.message || "Could not connect to the backend.",
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
