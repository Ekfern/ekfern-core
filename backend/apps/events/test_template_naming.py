from django.test import SimpleTestCase

from apps.events.services import template_naming


class TemplateNamingTests(SimpleTestCase):
    def test_humanize_event_type(self):
        self.assertEqual(template_naming.humanize_event_type("wedding"), "Wedding")
        self.assertEqual(template_naming.humanize_event_type("baby_shower"), "Baby Shower")

    def test_recipe_blurb_uses_description_prefix(self):
        s = template_naming.recipe_layout_blurb("card-then-banner", max_chars=80)
        self.assertIn("Card", s)
        self.assertIn("banner", s.lower())

    def test_card_image_descriptor_pulls_vision_tags(self):
        d = template_naming.card_image_descriptor({
            "card_feeling": "traditional",
            "card_style": "illustrated",
            "card_composition": "has_baked_text",
            "has_baked_text": True,
        })
        self.assertIn("traditional", d)
        self.assertIn("illustrated", d)
        self.assertIn("lettering", d.lower())

    def test_build_name_ties_event_card_and_structure(self):
        name = template_naming.build_auto_template_name(
            event_type="religious_ceremony",
            meta={
                "recipe_id": "title-leads-card",
                "preset_id": "rustic-craft",
                "tone": "warm",
                "card_feeling": "traditional",
                "card_style": "illustrated",
                "card_composition": "centered",
                "has_baked_text": False,
            },
            is_remix=False,
        )
        self.assertIn("Religious Ceremony", name)
        self.assertIn("traditional", name)
        self.assertIn("illustrated", name)
        self.assertIn("Rustic Craft", name)
        self.assertIn("warm wording", name)

    def test_remix_suffix(self):
        name = template_naming.build_auto_template_name(
            event_type="wedding",
            meta={
                "recipe_id": "card-then-title",
                "preset_id": "ivory-romance",
                "card_style": "minimal",
                "card_composition": "centered",
                "tone": "elegant",
            },
            is_remix=True,
        )
        self.assertIn("remix", name.lower())
