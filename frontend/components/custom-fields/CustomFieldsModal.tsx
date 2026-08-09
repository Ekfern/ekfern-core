'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCustomFields } from "./useCustomFields";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";

interface CustomFieldsModalProps {
    eventId: number;
    open: boolean;
    title: string;
    description: string;
    /** Metadata the caller already holds, so the modal need not refetch the event. */
    initialMetadata?: Record<string, any>;
    onClose: () => void;
    onUpdated: (metadata: Record<string, any>) => void;
}

export default function CustomFieldsModal({
    eventId,
    open,
    title,
    description,
    initialMetadata,
    onClose,
    onUpdated,
}: CustomFieldsModalProps) {
    const { showToast } = useToast();
    const {
        customFieldsDraft,
        setCustomFieldsDraft,
        makeDraftId,
        handleSaveCustomFields,
        loading,
        loadError,
        saving,
    } = useCustomFields(eventId, open, initialMetadata);

    if (!open) return null;

    const handleSave = async () => {
        const result = await handleSaveCustomFields();
        if (!result.ok) {
            // Keep the modal open so the draft survives a rejected save.
            showToast(result.error, "error");
            return;
        }
        showToast("Custom fields updated", "success");
        onUpdated(result.metadata);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
            <Card className="w-full max-w-2xl bg-white border-2 border-eco-green-light">
                <CardHeader>
                    <CardTitle className="text-eco-green">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {loadError ? (
                            <p className="text-sm text-red-600">{loadError}</p>
                        ) : loading ? (
                            <p className="text-sm text-gray-600">Loading custom fields...</p>
                        ) : customFieldsDraft.length === 0 ? (
                            <p className="text-sm text-gray-600">
                                No custom fields yet. Add one below.
                            </p>
                        ) : (
                            customFieldsDraft.map((row, idx) => (
                                <div key={row.id} className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <Input
                                            value={row.display_label}
                                            placeholder="e.g. Allergies"
                                            aria-label="Field name"
                                            onChange={(e) => {
                                                const next = [...customFieldsDraft];
                                                next[idx] = { ...row, display_label: e.target.value };
                                                setCustomFieldsDraft(next);
                                            }}
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 text-sm shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={row.active !== false}
                                            onChange={(e) => {
                                                const next = [...customFieldsDraft];
                                                next[idx] = { ...row, active: e.target.checked };
                                                setCustomFieldsDraft(next);
                                            }}
                                        />
                                        Active
                                    </label>
                                </div>
                            ))
                        )}
                    </div>

                    <p className="text-xs text-gray-500">
                        Renaming a field here changes only what you see. Answers already collected
                        stay attached, and your RSVP form keeps working.
                    </p>

                    <div className="flex flex-wrap gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={saving}
                            onClick={() =>
                                setCustomFieldsDraft((prev) => [
                                    ...prev,
                                    { id: makeDraftId(), display_label: "", active: true },
                                ])
                            }
                        >
                            + Add Field
                        </Button>

                        <div className="flex-1" />

                        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                            Close
                        </Button>

                        <Button
                            type="button"
                            className="bg-eco-green hover:bg-eco-green-dark text-white"
                            disabled={saving}
                            onClick={handleSave}
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
