"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "text" | "image";

export default function SubmitForm() {
    const [mode, setMode] = React.useState<Mode>("text");
    const [text, setText] = React.useState("");
    const [file, setFile] = React.useState<File | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [result, setResult] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);
        setError(null);

        try {
            if (!backendBase) {
                throw new Error(
                    "Missing NEXT_PUBLIC_BACKEND_URL. Set it in your environment to submit.",
                );
            }

            if (mode === "text" && !text.trim()) {
                throw new Error("Please enter some text to submit.");
            }
            if (mode === "image" && !file) {
                throw new Error("Please choose an image file to submit.");
            }

            const form = new FormData();
            form.append("type", mode);
            form.append("source", "moderator-ui");
            if (mode === "text") {
                form.append("text", text.trim());
            } else if (file) {
                form.append("file", file, file.name);
            }

            // const supabase = createSupabaseBrowserClient();
            // const {
            //     data: { session },
            // } = await supabase.auth.getSession();

            // const headers: Record<string, string> = {};
            // if (session?.access_token) {
            //     headers["Authorization"] = `Bearer ${session.access_token}`;
            // }

            const res = await fetch(`${backendBase.replace(/\/$/, "")}/submit`, {
                method: "POST",
                body: form,
            });

            const textBody = await res.text();
            if (!res.ok) {
                throw new Error(textBody || `Request failed with ${res.status}`);
            }

            // Try to pretty print JSON; fallback to raw text
            try {
                const json = JSON.parse(textBody);
                setResult(JSON.stringify(json, null, 2));
            } catch {
                setResult(textBody);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <input
                        id="mode-text"
                        type="radio"
                        name="mode"
                        value="text"
                        checked={mode === "text"}
                        onChange={() => setMode("text")}
                        className="h-4 w-4"
                    />
                    <Label htmlFor="mode-text">Text</Label>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        id="mode-image"
                        type="radio"
                        name="mode"
                        value="image"
                        checked={mode === "image"}
                        onChange={() => setMode("image")}
                        className="h-4 w-4"
                    />
                    <Label htmlFor="mode-image">Image</Label>
                </div>
            </div>

            {mode === "text" ? (
                <div className="grid gap-2">
                    <Label htmlFor="text">Text to moderate</Label>
                    <textarea
                        id="text"
                        className="min-h-28 w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Paste or type the text you want to submit"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                </div>
            ) : (
                <div className="grid gap-2">
                    <Label htmlFor="file">Image file</Label>
                    <Input
                        id="file"
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                    />
                    {file && (
                        <div className="text-xs text-muted-foreground">
                            Selected: {file.name} ({Math.ceil(file.size / 1024)} KB)
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={submitting}
                    onClick={() => {
                        setText("");
                        setFile(null);
                        setResult(null);
                        setError(null);
                    }}
                >
                    Reset
                </Button>
            </div>

            {error && (
                <pre className="whitespace-pre-wrap rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive-foreground">
                    {error}
                </pre>
            )}
            {result && (
                <pre className="whitespace-pre-wrap rounded-md border border-input bg-accent/30 p-3 text-sm">
                    {result}
                </pre>
            )}
        </form>
    );
}
