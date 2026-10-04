"""
The boundary that lets gunicorn run threaded workers: AWS clients are made
through apps.common.aws.aws_client, never boto3's shared default session.
"""
import re
import threading
from pathlib import Path

from django.test import SimpleTestCase

from apps.common.aws import aws_client

BACKEND = Path(__file__).resolve().parents[2]

# boto3.client(...) / boto3.resource(...) use the module-wide default session.
DEFAULT_SESSION_CALL = re.compile(r'\bboto3\.(client|resource)\(')


class AwsClientBoundaryTests(SimpleTestCase):
    def test_request_code_never_uses_the_default_boto3_session(self):
        """
        Two threads creating clients from the default session at once can fail
        inside botocore. Management commands run alone, in their own process.
        """
        offenders = []
        for path in (BACKEND / 'apps').rglob('*.py'):
            relative = path.relative_to(BACKEND).as_posix()
            if relative == 'apps/common/aws.py' or '/management/commands/' in relative:
                continue
            for number, line in enumerate(path.read_text().splitlines(), start=1):
                if DEFAULT_SESSION_CALL.search(line) and not line.lstrip().startswith('#'):
                    offenders.append(f'{relative}:{number}')
        self.assertEqual(offenders, [], 'Use apps.common.aws.aws_client instead of boto3.client')

    def test_each_thread_gets_its_own_session(self):
        sessions = {}

        def make(name):
            from apps.common import aws

            aws_client('s3', region_name='us-east-1')
            sessions[name] = aws._local.session

        threads = [threading.Thread(target=make, args=(n,)) for n in ('a', 'b')]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertIsNot(sessions['a'], sessions['b'])

    def test_one_thread_reuses_its_session(self):
        from apps.common import aws

        aws_client('s3', region_name='us-east-1')
        first = aws._local.session
        aws_client('ses', region_name='us-east-1')
        self.assertIs(aws._local.session, first)
