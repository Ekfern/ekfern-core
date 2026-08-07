"""
Admin path for data-subject requests (the "manual-but-able" MVP):

    manage.py privacy_subject --export --phone +91XXXXXXXXXX
    manage.py privacy_subject --erase  --email a@b.com --hard

Export prints everything held about the person; erase anonymizes (or hard-deletes
with --hard), always preserving FINANCIAL rows as pseudonymized.
"""
import json

from django.core.management.base import BaseCommand, CommandError

from apps.privacy.services import export_for_subject, erase_subject


class Command(BaseCommand):
    help = "Export or erase all personal data for a data subject (by phone and/or email)."

    def add_arguments(self, parser):
        parser.add_argument("--phone")
        parser.add_argument("--email")
        parser.add_argument("--export", action="store_true")
        parser.add_argument("--erase", action="store_true")
        parser.add_argument("--hard", action="store_true",
                            help="Hard-delete non-financial rows (default: anonymize)")

    def handle(self, *args, **opts):
        if not (opts["phone"] or opts["email"]):
            raise CommandError("Provide --phone and/or --email")
        if opts["export"] == opts["erase"]:
            raise CommandError("Choose exactly one of --export / --erase")

        if opts["export"]:
            data = export_for_subject(phone=opts["phone"], email=opts["email"])
            self.stdout.write(json.dumps(data, indent=2, default=str))
        else:
            result = erase_subject(phone=opts["phone"], email=opts["email"], hard=opts["hard"])
            self.stdout.write(json.dumps(result, indent=2))
