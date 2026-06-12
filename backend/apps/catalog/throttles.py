from rest_framework.throttling import AnonRateThrottle


class CatalogSubmissionThrottle(AnonRateThrottle):
    scope = 'catalog_submission'

    def get_cache_key(self, request, view):
        slug = view.kwargs.get('slug', 'unknown')
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{slug}_{ident}',
        }
