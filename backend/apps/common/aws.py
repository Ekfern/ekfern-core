"""
AWS clients that are safe to create from any request thread.

`boto3.client(...)` builds every client from one module-wide default session,
and boto3 sessions are not thread-safe: two threads creating clients at once
can fail inside botocore. Gunicorn runs threaded workers, so a request sending
an email and another uploading a photo can do exactly that.

Each thread gets its own session instead, made once and reused. A client made
from it is an ordinary boto3 client, thread-safe to use, and picks up
credentials the same way (keys if passed, otherwise the ECS task role).
"""
import threading

import boto3

_local = threading.local()


def aws_client(service_name, **kwargs):
    """Drop-in for boto3.client(service_name, **kwargs), safe across threads."""
    session = getattr(_local, 'session', None)
    if session is None:
        session = boto3.session.Session()
        _local.session = session
    return session.client(service_name, **kwargs)
