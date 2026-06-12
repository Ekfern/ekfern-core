from rest_framework import serializers

from .models import CatalogItem, CatalogResponse, HostCatalog


class HostCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostCatalog
        fields = [
            'id', 'event_id', 'is_enabled', 'purpose', 'catalog_title',
            'intro_text', 'catalog_access_mode', 'show_on_event_page',
            'show_on_rsvp_confirmation', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'event_id', 'created_at', 'updated_at']


class CatalogItemSerializer(serializers.ModelSerializer):
    # CharField instead of URLField so relative paths from local dev storage pass validation.
    # In production, upload_to_s3 always returns a full CloudFront URL.
    image_url = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = CatalogItem
        fields = [
            'id', 'catalog_id', 'title', 'description', 'image_url',
            'item_type', 'action_type', 'amount_type', 'fixed_amount',
            'suggested_amounts', 'external_url', 'manual_instructions',
            'status', 'sort_order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'catalog_id', 'created_at', 'updated_at']


class CatalogResponseSerializer(serializers.ModelSerializer):
    item_title = serializers.CharField(source='catalog_item.title', read_only=True)

    class Meta:
        model = CatalogResponse
        fields = [
            'id', 'catalog_item_id', 'item_title', 'event_id', 'guest_id',
            'name', 'email', 'phone', 'response_type', 'amount', 'message',
            'status', 'source', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'catalog_item_id', 'item_title', 'event_id', 'guest_id',
            'name', 'email', 'phone', 'response_type', 'amount', 'message',
            'source', 'created_at', 'updated_at',
        ]


class PublicCatalogItemSerializer(serializers.ModelSerializer):
    """Minimal serializer for guest-facing catalog view."""
    image_url = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = CatalogItem
        fields = [
            'id', 'title', 'description', 'image_url', 'item_type',
            'action_type', 'amount_type', 'fixed_amount', 'suggested_amounts',
            'external_url', 'manual_instructions', 'sort_order',
        ]


class CatalogResponseCreateSerializer(serializers.Serializer):
    catalog_item_id = serializers.IntegerField()
    response_type = serializers.ChoiceField(choices=CatalogResponse.RESPONSE_TYPE_CHOICES)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    amount = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    message = serializers.CharField(required=False, allow_blank=True)
    source = serializers.ChoiceField(
        choices=CatalogResponse.SOURCE_CHOICES,
        default='direct',
    )
