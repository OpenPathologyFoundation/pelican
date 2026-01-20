import os

from setuptools import find_packages, setup

with open('README.md') as fh:
    readme = fh.read()

description = 'FastAPI tile server for Large Image.'
long_description = readme

try:
    from setuptools_scm import get_version

    version = get_version(root='../..')
    limit_version = f'>={version}' if '+' not in version and not os.getenv('TOX_ENV_NAME') else ''
except (ImportError, LookupError):
    limit_version = ''

setup(
    name='large-image-server',
    description=description,
    long_description=long_description,
    long_description_content_type='text/markdown',
    license='Apache-2.0',
    author='Kitware Inc',
    author_email='kitware@kitware.com',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Topic :: Scientific/Engineering',
        'Topic :: Scientific/Engineering :: Medical Science Apps.',
        'Intended Audience :: Science/Research',
        'Intended Audience :: Healthcare Industry',
        'Framework :: FastAPI',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Programming Language :: Python :: 3.13',
        'Programming Language :: Python :: 3.14',
    ],
    python_requires='>=3.10',
    install_requires=[
        f'large-image{limit_version}',
        'fastapi>=0.109',
        'uvicorn[standard]>=0.27',
        'pydantic>=2.5',
        'pydantic-settings>=2.1',
    ],
    extras_require={
        'common': [
            f'large-image[common]{limit_version}',
        ],
        'sources': [
            f'large-image[sources]{limit_version}',
        ],
        'all': [
            f'large-image[all]{limit_version}',
        ],
        'redis': [
            'redis>=5.0',
        ],
        'memcached': [
            'pylibmc>=1.6.3 ; platform_system != "Windows"',
        ],
        'test': [
            'pytest>=7.0',
            'pytest-asyncio>=0.23',
            'httpx>=0.26',
        ],
    },
    packages=find_packages(),
    entry_points={
        'console_scripts': ['large_image_server = large_image_server.__main__:main'],
    },
)
