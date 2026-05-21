from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0079_alter_llmplatformsettings_decimal_defaults'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='event_type',
            field=models.CharField(
                max_length=50,
                default='wedding',
                choices=[
                    # Life Events
                    ('wedding', 'Wedding'),
                    ('engagement', 'Engagement'),
                    ('reception', 'Reception'),
                    ('anniversary', 'Anniversary'),
                    ('birthday', 'Birthday'),
                    ('baby_shower', 'Baby Shower'),
                    ('bridal_shower', 'Bridal Shower'),
                    ('bachelor_party', 'Bachelor Party'),
                    ('bachelorette_party', 'Bachelorette Party'),
                    ('gender_reveal', 'Gender Reveal'),
                    ('naming_ceremony', 'Naming Ceremony'),
                    ('housewarming', 'Housewarming'),
                    ('graduation', 'Graduation'),
                    ('retirement', 'Retirement'),
                    # Religious & Ceremonial
                    ('religious_ceremony', 'Religious Ceremony'),
                    ('puja', 'Puja'),
                    ('satsang', 'Satsang'),
                    ('church_service', 'Church Service'),
                    ('bar_mitzvah', 'Bar Mitzvah'),
                    ('bat_mitzvah', 'Bat Mitzvah'),
                    ('communion', 'Communion'),
                    ('confirmation', 'Confirmation'),
                    # Professional & Business
                    ('award_ceremony', 'Award Ceremony'),
                    ('conference', 'Conference'),
                    ('corporate_event', 'Corporate Event'),
                    ('networking', 'Networking Event'),
                    ('offsite', 'Offsite / Retreat'),
                    ('product_launch', 'Product Launch'),
                    ('seminar', 'Seminar'),
                    ('team_building', 'Team Building'),
                    ('town_hall', 'Town Hall'),
                    ('trade_show', 'Trade Show / Expo'),
                    ('training', 'Training / Onboarding'),
                    ('workshop', 'Workshop'),
                    # Social & Community
                    ('fundraiser', 'Fundraiser'),
                    ('charity_event', 'Charity Event'),
                    ('community_event', 'Community Event'),
                    ('festival', 'Festival'),
                    ('cultural_event', 'Cultural Event'),
                    ('exhibition', 'Exhibition'),
                    ('art_show', 'Art Show'),
                    # Entertainment
                    ('concert', 'Concert'),
                    ('music_event', 'Music Event'),
                    ('theater', 'Theater'),
                    ('comedy_show', 'Comedy Show'),
                    ('sports_event', 'Sports Event'),
                    # Food & Dining
                    ('dinner_party', 'Dinner Party'),
                    ('brunch', 'Brunch'),
                    ('cocktail_party', 'Cocktail Party'),
                    ('tea_party', 'Tea Party'),
                    ('potluck', 'Potluck'),
                    # Other
                    ('other', 'Other'),
                ],
            ),
        ),
    ]
