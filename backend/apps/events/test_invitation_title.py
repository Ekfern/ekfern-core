"""
Two names for one event: `title` is the host's own (dashboard, co-host emails);
`invitation_title` is the invitation's headline, which everything guests read -
and the notifications about them - uses.
"""
from django.test import SimpleTestCase, TestCase

from apps.common.whatsapp_backend import replace_template_variables
from apps.events.models import Event, InvitePage, invitation_title_from_config
from apps.events.serializers import InvitePageSerializer
from apps.events.utils import render_template_with_guest
from apps.users.models import User


def title_tile(text, order=0, enabled=True, tile_id='t'):
    return {'id': tile_id, 'type': 'title', 'enabled': enabled, 'order': order, 'settings': {'text': text}}


class InvitationTitleFromConfigTests(SimpleTestCase):
    def test_first_enabled_title_by_order(self):
        config = {'tiles': [
            title_tile('Second', order=2, tile_id='b'),
            title_tile('Hidden', order=0, enabled=False, tile_id='a'),
            title_tile('  Riya   weds\nKabir ', order=1, tile_id='c'),
        ]}
        self.assertEqual(invitation_title_from_config(config), 'Riya weds Kabir')

    def test_nothing_usable_is_none(self):
        for config in (None, {}, {'tiles': 'x'}, {'tiles': [title_tile('   ')]}, {'tiles': [{'type': 'footer'}]}):
            self.assertIsNone(invitation_title_from_config(config))


class EventInvitationTitleTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='title-host@test.com', name='Asha')
        self.event = Event.objects.create(host=self.host, slug='sharma-wedding', title='Sharma wedding')

    def fresh(self):
        return Event.objects.get(pk=self.event.pk)

    def test_falls_back_to_the_event_title(self):
        self.assertEqual(self.fresh().invitation_title, 'Sharma wedding')

    def test_published_headline_wins_over_draft(self):
        InvitePage.objects.create(
            event=self.event, slug=self.event.slug,
            config={'tiles': [title_tile('Draft headline')]},
            published_config={'tiles': [title_tile('Riya weds Kabir')]},
        )
        self.assertEqual(self.fresh().invitation_title, 'Riya weds Kabir')

    def test_draft_headline_before_anything_is_published(self):
        InvitePage.objects.create(event=self.event, slug=self.event.slug, config={'tiles': [title_tile('Riya weds Kabir')]})
        self.assertEqual(self.fresh().invitation_title, 'Riya weds Kabir')

    def test_page_config_when_there_is_no_invite_page(self):
        self.event.page_config = {'tiles': [title_tile('From the editor')]}
        self.event.save(update_fields=['page_config'])
        self.assertEqual(self.fresh().invitation_title, 'From the editor')


class GuestsReadTheHeadlineTests(TestCase):
    def setUp(self):
        host = User.objects.create_user(email='headline-host@test.com', name='Asha')
        self.event = Event.objects.create(host=host, slug='sharma-wedding-2', title='Sharma wedding')
        self.page = InvitePage.objects.create(
            event=self.event, slug=self.event.slug, is_published=True,
            config={'tiles': [title_tile('Riya weds Kabir')]},
            published_config={'tiles': [title_tile('Riya weds Kabir')]},
        )

    def test_whatsapp_and_message_templates(self):
        event = Event.objects.get(pk=self.event.pk)
        self.assertIn('Riya weds Kabir', replace_template_variables('Join us for [event_title]', None, event))
        rendered, _ = render_template_with_guest('Join us for [event_title]', event)
        self.assertIn('Riya weds Kabir', rendered)

    def test_public_invitation_title(self):
        self.assertEqual(InvitePageSerializer(self.page).data['title'], 'Riya weds Kabir')

    def test_co_host_emails_keep_the_hosts_name_for_it(self):
        from apps.common import emails

        rendered = emails.cohost_invite(
            inviter='Asha', event_title=self.event.title, invited_email='x@y.com',
            capabilities=[], link='https://example.com',
        )
        self.assertIn('Sharma wedding', rendered.subject)
