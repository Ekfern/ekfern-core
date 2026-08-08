import { useEffect, useState } from "react";
import api from "@/lib/api";


export interface CustomFieldMeta {
    id: string;
    key: string;
    originalKey?: string;
    display_label: string;
    active: boolean;
}

export function useCustomFields(eventId: number, open: boolean) {
    const [customFieldsDraft, setCustomFieldsDraft] = useState<CustomFieldMeta[]>([]);

    const [saving, setSaving] = useState(false);
    const makeDraftId = () =>
        `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const normalizeCustomFieldKey = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");
    useEffect(() => {
        if (!open) return;

        const load = async () => {
            const resp = await api.get(`/api/events/${eventId}/`);

            const meta = resp.data?.custom_fields_metadata || {};

            const rows: CustomFieldMeta[] = Object.entries(meta).map(
                ([key, value]: any) => {
                    if (typeof value === "string") {
                        return {
                            id: key,
                            key,
                            originalKey: key,
                            display_label: value,
                            active: true,
                        };
                    }

                    return {
                        id: key,
                        key,
                        originalKey: key,
                        display_label: value?.display_label || key,
                        active: value?.active !== false,
                    };
                }
            );

            setCustomFieldsDraft(
                rows.sort((a, b) => a.display_label.localeCompare(b.display_label))
            );
        };

        load();
    }, [eventId, open]);

    const handleSaveCustomFields = async () => {
        const MAX_FIELDS = 50;

        if (customFieldsDraft.length > MAX_FIELDS) {
            throw new Error(`Too many custom fields (max ${MAX_FIELDS})`);
        }

        const upsert: any[] = [];
        const rename: any[] = [];

        customFieldsDraft.forEach((row) => {
            const key = normalizeCustomFieldKey(row.key);

            if (!key) return;

            const display_label = (row.display_label || key).slice(0, 80);
            const active = row.active !== false;

            if (row.originalKey && row.originalKey !== key) {
                rename.push({
                    from: row.originalKey,
                    to: key,
                    display_label,
                });

                upsert.push({
                    key,
                    display_label,
                    active,
                });
            } else {
                upsert.push({
                    key,
                    display_label,
                    active,
                });
            }
        });

        const resp = await api.patch(
            `/api/events/${eventId}/custom-fields/`,
            {
                upsert,
                rename,
            }
        );

        return resp.data.custom_fields_metadata;
    };

    return {
        customFieldsDraft,
        setCustomFieldsDraft,
        makeDraftId,
        normalizeCustomFieldKey,
        handleSaveCustomFields,
        saving,
        setSaving,
    };
}