import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage, logError } from "@/lib/error-handler";

export interface CustomFieldMeta {
    /** Row identity for React. Server key for saved rows, a draft id for new ones. */
    id: string;
    /**
     * Immutable server-minted key, or undefined for a row not yet saved. Never
     * edited here: it is what the RSVP form config, invite/WhatsApp template
     * variables, saved guest-list filters, and every guest's stored answers
     * point at. The server derives it from the label on create and refuses to
     * change it afterwards.
     */
    key?: string;
    display_label: string;
    active: boolean;
}

const MAX_FIELDS = 50;
const MAX_LABEL_LENGTH = 80;

export const metadataToRows = (meta: Record<string, any>): CustomFieldMeta[] => {
    const rows: CustomFieldMeta[] = Object.entries(meta || {}).map(([key, value]: any) => {
        if (typeof value === "string") {
            return { id: key, key, display_label: value, active: true };
        }
        return {
            id: key,
            key,
            display_label: value?.display_label || key,
            active: value?.active !== false,
        };
    });
    return rows.sort((a, b) => a.display_label.localeCompare(b.display_label));
};

type SaveResult =
    | { ok: true; metadata: Record<string, any> }
    | { ok: false; error: string };

export function useCustomFields(
    eventId: number,
    open: boolean,
    initialMetadata?: Record<string, any>,
) {
    const [customFieldsDraft, setCustomFieldsDraft] = useState<CustomFieldMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string>("");
    const [saving, setSaving] = useState(false);

    const makeDraftId = () =>
        `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    useEffect(() => {
        if (!open) return;

        // Both host pages already hold the event; only hit the network when a
        // caller cannot supply the metadata itself.
        if (initialMetadata) {
            setCustomFieldsDraft(metadataToRows(initialMetadata));
            setLoadError("");
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setLoadError("");
            try {
                const resp = await api.get(`/api/events/${eventId}/`);
                if (cancelled) return;
                setCustomFieldsDraft(metadataToRows(resp.data?.custom_fields_metadata || {}));
            } catch (error: any) {
                if (cancelled) return;
                logError("Failed to load custom fields:", error);
                setLoadError(getErrorMessage(error));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId, open]);

    const handleSaveCustomFields = useCallback(async (): Promise<SaveResult> => {
        if (customFieldsDraft.length > MAX_FIELDS) {
            return { ok: false, error: `Too many custom fields (max ${MAX_FIELDS})` };
        }

        // Rows with a key are label/active edits. Rows without one are new
        // fields; the server mints the key from the label.
        const upsert = customFieldsDraft
            .filter((row) => (row.display_label || "").trim())
            .map((row) => ({
                ...(row.key ? { key: row.key } : {}),
                label: row.display_label.trim().slice(0, MAX_LABEL_LENGTH),
                active: row.active !== false,
            }));

        setSaving(true);
        try {
            const resp = await api.patch(`/api/events/${eventId}/custom-fields/`, { upsert });
            const metadata = resp.data.custom_fields_metadata || {};
            // Re-seed from the server so newly created rows pick up their minted keys.
            setCustomFieldsDraft(metadataToRows(metadata));
            return { ok: true, metadata };
        } catch (error: any) {
            logError("Failed to update custom fields:", error);
            return { ok: false, error: getErrorMessage(error) };
        } finally {
            setSaving(false);
        }
    }, [customFieldsDraft, eventId]);

    return {
        customFieldsDraft,
        setCustomFieldsDraft,
        makeDraftId,
        handleSaveCustomFields,
        loading,
        loadError,
        saving,
    };
}
