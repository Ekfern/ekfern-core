"""
Admin path for data-subject requests (the "manual-but-able" MVP):

    manage.py privacy_subject --export --phone +91XXXXXXXXXX \
        --actor ops@company.com --reason TICKET-123
    manage.py privacy_subject --erase --email a@b.com --hard \
        --actor ops@company.com --reason TICKET-123

Every run REQUIRES an operator identity (--actor) and a justification (--reason)
for attribution; these are threaded into the underlying services so the action
lands in the audit ledger.

--export writes the full export JSON to a file under privacy_exports/ (override
with --out) and prints ONLY a receipt to stdout — never raw PII. --erase
anonymizes non-financial rows (or hard-deletes with --hard), always preserving
FINANCIAL rows as pseudonymized, and prints a counts-only summary.
"""
import json
import os
import stat
from datetime import datetime, timezone

from django.conf import settings
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
        parser.add_argument("--actor", required=True,
                            help="Operator identity performing this request (for attribution).")
        parser.add_argument("--reason", required=True,
                            help="Ticket / justification for this request (for attribution).")
        parser.add_argument("--out",
                            help="Directory to write the export file to "
                                 "(default: <BASE_DIR>/privacy_exports).")

    def handle(self, *args, **opts):
        if not (opts["phone"] or opts["email"]):
            raise CommandError("Provide --phone and/or --email")
        if opts["export"] == opts["erase"]:
            raise CommandError("Choose exactly one of --export / --erase")
        actor = (opts["actor"] or "").strip()
        reason = (opts["reason"] or "").strip()
        if not actor:
            raise CommandError("--actor must not be empty")
        if not reason:
            raise CommandError("--reason must not be empty")

        timestamp = datetime.now(timezone.utc).isoformat()

        if opts["export"]:
            data = export_for_subject(
                phone=opts["phone"], email=opts["email"],
                actor=actor, reason=reason,
            )
            out_dir = opts.get("out") or os.path.join(getattr(settings, "BASE_DIR", "."), "privacy_exports")
            os.makedirs(out_dir, exist_ok=True)
            try:
                os.chmod(out_dir, stat.S_IRWXU)  # 0700 — operator-only
            except OSError:
                pass
            fname = "subject_export_{:%Y%m%dT%H%M%SZ}.json".format(datetime.now(timezone.utc))
            out_path = os.path.join(out_dir, fname)
            # Open with restrictive permissions (0600) so PII isn't world-readable.
            fd = os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as fh:
                json.dump(data, fh, indent=2, default=str)

            counts = {k: (len(v) if isinstance(v, (list, dict)) else 1)
                      for k, v in (data.items() if isinstance(data, dict) else [])}
            self.stdout.write("privacy export receipt")
            self.stdout.write(f"  path:    {out_path}")
            self.stdout.write(f"  counts:  {json.dumps(counts, default=str)}")
            self.stdout.write(f"  actor:   {actor}")
            self.stdout.write(f"  reason:  {reason}")
            self.stdout.write(f"  time:    {timestamp}")
        else:
            result = erase_subject(
                phone=opts["phone"], email=opts["email"], hard=opts["hard"],
                actor=actor, reason=reason,
            )
            self.stdout.write("privacy erase summary")
            self.stdout.write(f"  mode:    {'hard' if opts['hard'] else 'anonymize'}")
            self.stdout.write(f"  actor:   {actor}")
            self.stdout.write(f"  reason:  {reason}")
            self.stdout.write(f"  time:    {timestamp}")
            self.stdout.write(json.dumps(result, indent=2, default=str))
