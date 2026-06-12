import logging

from django.db import models

from apps.events.models import Event, Guest

logger = logging.getLogger(__name__)


class HostCatalog(models.Model):
    PURPOSE_CHOICES = [
        ('gifts', 'Gifts / Contributions'),
        ('fundraiser', 'Fundraiser'),
        ('products_services', 'Products or Services'),
        ('event_addons', 'Event Add-ons'),
        ('sponsorships', 'Sponsorships'),
        ('general', 'General Catalog'),
    ]
    ACCESS_CHOICES = [
        ('same_as_event', 'Same as event page'),
        ('after_rsvp', 'After RSVP is submitted'),
        ('confirmed_only', 'Only confirmed / attending guests'),
    ]

    event = models.OneToOneField(
        Event, on_delete=models.CASCADE, related_name='host_catalog'
    )
    is_enabled = models.BooleanField(default=True)
    purpose = models.CharField(
        max_length=30, choices=PURPOSE_CHOICES, default='general'
    )
    catalog_title = models.CharField(
        max_length=100, blank=True, default='',
        help_text='Section heading shown to guests (e.g. "Our Gift Registry")',
    )
    intro_text = models.TextField(blank=True)
    catalog_access_mode = models.CharField(
        max_length=20, choices=ACCESS_CHOICES, default='same_as_event'
    )
    show_on_event_page = models.BooleanField(default=True)
    show_on_rsvp_confirmation = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'host_catalog'

    def __str__(self):
        return f'Catalog — {self.event.title}'


class CatalogItem(models.Model):
    ITEM_TYPE_CHOICES = [
        ('contribution', 'Contribution'),
        ('offer_addon', 'Offer / Add-on'),
        ('info_link', 'Info / Link'),
    ]
    ACTION_TYPE_CHOICES = [
        ('pledge_amount', 'Pledge amount'),
        ('submit_interest', 'Submit interest'),
        ('open_external_link', 'Open external link'),
        ('contact_host', 'Contact host'),
    ]
    AMOUNT_TYPE_CHOICES = [
        ('none', 'No amount'),
        ('fixed', 'Fixed amount'),
        ('suggested', 'Suggested amounts'),
        ('flexible', 'Flexible amount'),
    ]
    STATUS_CHOICES = [
        ('published', 'Published'),
        ('hidden', 'Hidden'),
    ]

    catalog = models.ForeignKey(
        HostCatalog, on_delete=models.CASCADE, related_name='items'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True, null=True, max_length=500)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES)
    action_type = models.CharField(max_length=25, choices=ACTION_TYPE_CHOICES)
    amount_type = models.CharField(
        max_length=10, choices=AMOUNT_TYPE_CHOICES, null=True, blank=True
    )
    fixed_amount = models.IntegerField(
        null=True, blank=True,
        help_text='Amount in paise (e.g. 200000 = ₹2,000)',
    )
    suggested_amounts = models.JSONField(
        null=True, blank=True,
        help_text='List of integers in paise (e.g. [50000, 100000, 200000])',
    )
    external_url = models.URLField(blank=True, null=True, max_length=500)
    manual_instructions = models.TextField(
        blank=True,
        help_text='Shown to guest after form submission',
    )
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='published'
    )
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalog_items'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.title} ({self.catalog.event.title})'


class CatalogResponse(models.Model):
    RESPONSE_TYPE_CHOICES = [
        ('pledge', 'Pledge'),
        ('interest', 'Interest'),
        ('external_click', 'External click'),
        ('host_message', 'Host message'),
    ]
    STATUS_CHOICES = [
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    SOURCE_CHOICES = [
        ('event_page', 'Event page'),
        ('rsvp_confirmation', 'RSVP confirmation'),
        ('invite', 'Invite'),
        ('direct', 'Direct link'),
        ('qr', 'QR code'),
    ]

    catalog_item = models.ForeignKey(
        CatalogItem, on_delete=models.CASCADE, related_name='responses'
    )
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name='catalog_responses'
    )
    guest = models.ForeignKey(
        Guest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='catalog_responses',
    )
    name = models.CharField(max_length=255)
    email = models.EmailField()
    phone = models.CharField(max_length=20, blank=True)
    response_type = models.CharField(max_length=20, choices=RESPONSE_TYPE_CHOICES)
    amount = models.IntegerField(
        null=True, blank=True,
        help_text='Amount in paise',
    )
    message = models.TextField(blank=True)
    status = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default='new'
    )
    source = models.CharField(
        max_length=20, choices=SOURCE_CHOICES, default='direct'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalog_responses'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} → {self.catalog_item.title} ({self.response_type})'
