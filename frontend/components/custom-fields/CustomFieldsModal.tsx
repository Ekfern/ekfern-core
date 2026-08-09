import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomFields } from "./useCustomFields";

import api from "@/lib/api";
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
    onClose: () => void;
    onUpdated: (metadata: Record<string, any>) => void;
}

export default function CustomFieldsModal({
    eventId,
    open,
    title,
    description,
    onClose,
    onUpdated,
}: CustomFieldsModalProps) {
    const {
        customFieldsDraft,
        setCustomFieldsDraft,
        makeDraftId,
        handleSaveCustomFields,
    } = useCustomFields(eventId, open);

    const [saving, setSaving] = useState(false)


    const normalizeCustomFieldKey = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "")


    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-4xl bg-white border-2 border-eco-green-light">
                <CardHeader>
                    <CardTitle className="text-eco-green">
                        {title}
                    </CardTitle>

                    <CardDescription>
                        {description}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        {customFieldsDraft.length === 0 ? (
                            <p className="text-sm text-gray-600">
                                No custom fields yet. Add one below.
                            </p>
                        ) : (
                            customFieldsDraft.map((row, idx) => (
                                <div
                                    key={row.id}
                                    className="grid grid-cols-12 gap-2 items-center"
                                >
                                    <div className="col-span-4">
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Key
                                        </label>

                                        <Input
                                            value={row.key}
                                            onChange={(e) => {
                                                const next = [...customFieldsDraft];
                                                next[idx] = {
                                                    ...row,
                                                    key: e.target.value,
                                                };
                                                setCustomFieldsDraft(next);
                                            }}
                                        />
                                    </div>

                                    <div className="col-span-6">
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Label
                                        </label>

                                        <Input
                                            value={row.display_label}
                                            onChange={(e) => {
                                                const next = [...customFieldsDraft];
                                                next[idx] = {
                                                    ...row,
                                                    display_label: e.target.value,
                                                };
                                                setCustomFieldsDraft(next);
                                            }}
                                        />
                                    </div>

                                    <div className="col-span-2 flex items-end">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={row.active !== false}
                                                onChange={(e) => {
                                                    const next = [...customFieldsDraft];
                                                    next[idx] = {
                                                        ...row,
                                                        active: e.target.checked,
                                                    };
                                                    setCustomFieldsDraft(next);
                                                }}
                                            />
                                            Active
                                        </label>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setCustomFieldsDraft((prev) => [
                                    ...prev,
                                    {
                                        id: makeDraftId(),
                                        key: "",
                                        display_label: "",
                                        active: true,
                                    },
                                ])
                            }
                        >
                            + Add Field
                        </Button>

                        <div className="flex-1" />

                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Close
                        </Button>

                        <Button
                            type="button"
                            className="bg-eco-green hover:bg-eco-green-dark text-white"
                            onClick={async () => {
                                const metadata = await handleSaveCustomFields();
                                onUpdated(metadata);
                                onClose();
                            }}
                        >
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}