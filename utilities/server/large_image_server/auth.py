"""JWT Authentication middleware for Large Image Server.

Provides optional JWT authentication that can be enabled via configuration.
When enabled, all tile-serving endpoints require a valid JWT token.

Per SRS SYS-IMS-036: JWT authentication middleware for access control.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Optional jwt import - only required if JWT is enabled
try:
    import jwt

    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    jwt = None  # type: ignore[assignment]


class OptionalJWTBearer(HTTPBearer):
    """JWT Bearer authentication that can be optionally enforced.

    When JWT is disabled in settings, this returns None and allows access.
    When enabled, it validates the Bearer token and returns the decoded payload.
    """

    def __init__(self, auto_error: bool = False):
        """Initialize with auto_error=False to allow optional auth."""
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> dict | None:
        """Extract and validate JWT token from request.

        Returns:
            Decoded JWT payload if valid, None if JWT is disabled.

        Raises:
            HTTPException: If JWT is enabled but token is invalid/missing.
        """
        from .config import get_settings

        settings = get_settings()

        # If JWT is not enabled, allow all requests
        if not settings.jwt_enabled:
            return None

        # JWT is enabled but library not available
        if not JWT_AVAILABLE:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail='JWT authentication is enabled but PyJWT is not installed. '
                'Install with: pip install PyJWT',
            )

        # Get credentials from Authorization header
        credentials: HTTPAuthorizationCredentials | None = await super().__call__(request)

        if credentials is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail='Authorization header missing',
                headers={'WWW-Authenticate': 'Bearer'},
            )

        # Validate the token
        return verify_jwt_token(
            credentials.credentials,
            settings.jwt_secret,
            settings.jwt_algorithm,
            settings.jwt_audience,
            settings.jwt_issuer,
        )


def verify_jwt_token(
    token: str,
    secret: str | None,
    algorithm: str = 'HS256',
    audience: str | None = None,
    issuer: str | None = None,
) -> dict:
    """Verify a JWT token and return the decoded payload.

    Args:
        token: The JWT token string to verify.
        secret: The secret key for HS* algorithms or public key for RS* algorithms.
        algorithm: The algorithm used to sign the token.
        audience: Expected audience claim (optional).
        issuer: Expected issuer claim (optional).

    Returns:
        Decoded JWT payload as a dictionary.

    Raises:
        HTTPException: If token is invalid, expired, or verification fails.
    """
    if not JWT_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='PyJWT library is not installed',
        )

    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='JWT secret is not configured',
        )

    try:
        # Build decode options
        options = {}
        decode_kwargs: dict = {
            'algorithms': [algorithm],
        }

        if audience:
            decode_kwargs['audience'] = audience
        else:
            options['verify_aud'] = False

        if issuer:
            decode_kwargs['issuer'] = issuer

        if options:
            decode_kwargs['options'] = options

        # Decode and verify the token
        payload = jwt.decode(token, secret, **decode_kwargs)
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Token has expired',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token audience',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid token issuer',
            headers={'WWW-Authenticate': 'Bearer'},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f'Invalid token: {e!s}',
            headers={'WWW-Authenticate': 'Bearer'},
        )


# Dependency for routes that require authentication
jwt_bearer = OptionalJWTBearer()

# Type alias for use in route dependencies
JWTPayload = Annotated[dict | None, Depends(jwt_bearer)]


def get_current_user(payload: JWTPayload) -> dict | None:
    """Extract current user information from JWT payload.

    This is a convenience dependency that can be used in routes
    to get the authenticated user's information.

    Args:
        payload: The decoded JWT payload from the bearer token.

    Returns:
        The user information from the JWT payload, or None if JWT is disabled.
    """
    return payload


# Dependency for getting current user
CurrentUser = Annotated[dict | None, Depends(get_current_user)]
