"""Tests for the ingestion API endpoint (SDS-STR-001 §7).

All tests mock the database layer and large_image, using a temporary
filesystem for slide storage.
"""

import hashlib
import hmac as hmac_mod
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from large_image_server.routes.ingest import (
    _derive_slide_id,
    _extract_format,
    _parse_year_from_case_id,
)


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------

class TestParseYearFromCaseId:

    def test_surgical(self):
        assert _parse_year_from_case_id('S26-0001') == '2026'

    def test_proficiency(self):
        assert _parse_year_from_case_id('PS26-00001') == '2026'

    def test_cytology(self):
        assert _parse_year_from_case_id('C27-0001') == '2027'

    def test_autopsy(self):
        assert _parse_year_from_case_id('A25-0001') == '2025'

    def test_invalid(self):
        with pytest.raises(ValueError, match='Cannot extract year'):
            _parse_year_from_case_id('12345')


class TestDeriveSlideId:

    def test_svs(self):
        assert _derive_slide_id('S26-0001_A1_S1.svs') == 'S26-0001_A1_S1'

    def test_ome_tiff(self):
        assert _derive_slide_id('S26-0004_A3_S1.ome.tiff') == 'S26-0004_A3_S1'

    def test_no_extension(self):
        assert _derive_slide_id('slide_no_ext') == 'slide_no_ext'


class TestExtractFormat:

    def test_svs(self):
        assert _extract_format('slide.svs') == 'svs'

    def test_ome_tiff(self):
        assert _extract_format('slide.ome.tiff') == 'ome.tiff'

    def test_no_ext(self):
        assert _extract_format('noext') == ''


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def clinical_root(tmp_path):
    root = tmp_path / 'clinical'
    root.mkdir()
    return root


@pytest.fixture()
def ingest_app(clinical_root):
    """Create a test app configured for ingestion."""
    from large_image_server import create_app

    app = create_app(
        image_dir=str(clinical_root),
        storage_db_url='postgresql://fake:fake@localhost:5432/fake',
        storage_clinical_root=clinical_root,
        hmac_key='test-secret-key',
    )
    return app


@pytest.fixture()
def ingest_client(ingest_app):
    return TestClient(ingest_app)


def _make_slide_file(content: bytes = b'\x00' * 256) -> tuple[str, bytes]:
    """Return (filename, content) for a fake slide upload."""
    return 'S26-0001_A1_S1.svs', content


def _slide_row_result(**overrides):
    """Build a dict matching what db.ingest_slide_transactional returns."""
    defaults = {
        'id': 'uuid-001',
        'slide_id': 'S26-0001_A1_S1',
        'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
        'format': 'svs',
        'hmac': 'a' * 64,
        'size_bytes': 256,
        'width_px': 50000,
        'height_px': 40000,
        'magnification': 40.0,
        'mpp_x': 0.25,
        'mpp_y': 0.25,
    }
    defaults.update(overrides)
    return defaults


# ---------------------------------------------------------------------------
# POST /admin/ingest/clinical tests
# ---------------------------------------------------------------------------

class TestIngestClinicalSlide:

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_happy_path(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Full upload: file written, HMAC computed, DB record created."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None  # no duplicate
        mock_meta.return_value = {
            'width_px': 50000,
            'height_px': 40000,
            'magnification': 40.0,
            'mpp_x': 0.25,
            'mpp_y': 0.25,
        }
        mock_db.ingest_slide_transactional.return_value = _slide_row_result()

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={
                'case_id': 'S26-0001',
                'part_label': 'A',
                'block_label': '1',
                'stain': 'H&E',
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert body['slideId'] == 'S26-0001_A1_S1'
        assert body['caseId'] == 'S26-0001'
        assert body['relativePath'] == '2026/S26-0001/S26-0001_A1_S1.svs'

        # Verify file was written to correct path
        written = clinical_root / '2026' / 'S26-0001' / 'S26-0001_A1_S1.svs'
        assert written.exists()
        assert written.read_bytes() == content

        # Verify HMAC was passed to DB
        call_kwargs = mock_db.ingest_slide_transactional.call_args
        assert call_kwargs.kwargs['hmac_hex'] or call_kwargs[1].get('hmac_hex')

    @patch('large_image_server.routes.ingest.db')
    def test_duplicate_slide_rejected(self, mock_db, ingest_client):
        """Second upload of same slide_id -> 409."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = {'slide_id': 'S26-0001_A1_S1'}

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'case_id': 'S26-0001', 'part_label': 'A', 'block_label': '1'},
        )

        assert response.status_code == 409
        assert 'already exists' in response.json()['detail']

    @patch('large_image_server.routes.ingest.db')
    def test_file_exists_on_disk_rejected(self, mock_db, ingest_client, clinical_root):
        """Target file already on disk -> 409."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None

        # Pre-create the file on disk
        target = clinical_root / '2026' / 'S26-0001'
        target.mkdir(parents=True)
        (target / 'S26-0001_A1_S1.svs').write_bytes(b'existing')

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'case_id': 'S26-0001', 'part_label': 'A', 'block_label': '1'},
        )

        assert response.status_code == 409
        assert 'already exists on disk' in response.json()['detail']

    def test_missing_required_fields(self, ingest_client):
        """No case_id -> 422 (FastAPI validation)."""
        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'part_label': 'A', 'block_label': '1'},
            # case_id missing
        )

        assert response.status_code == 422

    def test_db_not_configured(self, clinical_root):
        """No --db-url -> 503."""
        from large_image_server import create_app

        app = create_app(
            image_dir=str(clinical_root),
            hmac_key='key',
            storage_clinical_root=clinical_root,
        )
        client = TestClient(app)

        filename, content = _make_slide_file()
        response = client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'case_id': 'S26-0001', 'part_label': 'A', 'block_label': '1'},
        )

        assert response.status_code == 503
        assert 'Database not configured' in response.json()['detail']

    def test_hmac_key_not_configured(self, clinical_root):
        """No hmac_key -> 503."""
        from large_image_server import create_app

        app = create_app(
            image_dir=str(clinical_root),
            storage_db_url='postgresql://fake:fake@localhost:5432/fake',
            storage_clinical_root=clinical_root,
            # hmac_key omitted
        )
        client = TestClient(app)

        with patch('large_image_server.routes.ingest.db') as mock_db:
            mock_db.is_configured.return_value = True
            filename, content = _make_slide_file()
            response = client.post(
                '/admin/ingest/clinical',
                files={'file': (filename, content)},
                data={'case_id': 'S26-0001', 'part_label': 'A', 'block_label': '1'},
            )

        assert response.status_code == 503
        assert 'HMAC key not configured' in response.json()['detail']

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_rollback_on_db_error(self, mock_db, mock_meta, ingest_client, clinical_root):
        """DB insert fails -> file cleaned up."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None
        mock_meta.return_value = {}
        mock_db.ingest_slide_transactional.side_effect = RuntimeError('DB boom')

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'case_id': 'S26-0001', 'part_label': 'A', 'block_label': '1'},
        )

        assert response.status_code == 500

        # Verify file was cleaned up
        written = clinical_root / '2026' / 'S26-0001' / 'S26-0001_A1_S1.svs'
        assert not written.exists()

    @patch('large_image_server.routes.ingest.db')
    def test_invalid_case_id_format(self, mock_db, ingest_client):
        """Invalid case_id pattern -> 400."""
        mock_db.is_configured.return_value = True

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={'case_id': '12345', 'part_label': 'A', 'block_label': '1'},
        )

        assert response.status_code == 400
        assert 'Invalid case_id format' in response.json()['detail']

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_patient_mrn_resolved(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Patient MRN is resolved to patient_id FK via db lookup."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None
        mock_meta.return_value = {}
        mock_db.get_patient_by_mrn.return_value = {
            'id': 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            'mrn': 'XN-000003',
            'display_name': 'DOE, JANE',
            'sex': 'F',
            'dob': '1985-03-15',
        }
        mock_db.ingest_slide_transactional.return_value = _slide_row_result()

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={
                'case_id': 'S26-0001',
                'part_label': 'A',
                'block_label': '1',
                'patient_mrn': 'XN-000003',
            },
        )

        assert response.status_code == 201
        call_kwargs = mock_db.ingest_slide_transactional.call_args
        assert call_kwargs.kwargs['patient_id'] == 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_patient_uuid_resolved(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Patient UUID is resolved to patient_id FK via db lookup."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None
        mock_meta.return_value = {}
        patient_uuid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
        mock_db.get_patient_by_uuid.return_value = {
            'id': patient_uuid,
            'mrn': 'XN-000003',
            'display_name': 'DOE, JANE',
            'sex': 'F',
            'dob': '1985-03-15',
        }
        mock_db.ingest_slide_transactional.return_value = _slide_row_result()

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={
                'case_id': 'S26-0001',
                'part_label': 'A',
                'block_label': '1',
                'patient_uuid': patient_uuid,
            },
        )

        assert response.status_code == 201
        call_kwargs = mock_db.ingest_slide_transactional.call_args
        assert call_kwargs.kwargs['patient_id'] == patient_uuid

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_patient_mrn_not_found(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Unknown patient MRN returns 400 and cleans up the file."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None
        mock_meta.return_value = {}
        mock_db.get_patient_by_mrn.return_value = None

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={
                'case_id': 'S26-0001',
                'part_label': 'A',
                'block_label': '1',
                'patient_mrn': 'NONEXISTENT',
            },
        )

        assert response.status_code == 400
        assert 'Patient not found for MRN: NONEXISTENT' in response.json()['detail']

        # Verify file was cleaned up
        written = clinical_root / '2026' / 'S26-0001' / 'S26-0001_A1_S1.svs'
        assert not written.exists()

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_no_patient_fields(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Omitting both patient_mrn and patient_uuid passes patient_id=None."""
        mock_db.is_configured.return_value = True
        mock_db.get_slide_by_id.return_value = None
        mock_meta.return_value = {}
        mock_db.ingest_slide_transactional.return_value = _slide_row_result()

        filename, content = _make_slide_file()
        response = ingest_client.post(
            '/admin/ingest/clinical',
            files={'file': (filename, content)},
            data={
                'case_id': 'S26-0001',
                'part_label': 'A',
                'block_label': '1',
            },
        )

        assert response.status_code == 201
        call_kwargs = mock_db.ingest_slide_transactional.call_args
        assert call_kwargs.kwargs['patient_id'] is None


# ---------------------------------------------------------------------------
# GET /admin/ingest/verify/{slide_id} tests
# ---------------------------------------------------------------------------

class TestVerifySlide:

    @patch('large_image_server.routes.ingest.db')
    def test_verify_success(self, mock_db, ingest_client, clinical_root):
        """HMAC matches -> verified: true."""
        # Write a file and compute its real HMAC
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True)
        slide_file = slide_dir / 'S26-0001_A1_S1.svs'
        content = b'test slide content'
        slide_file.write_bytes(content)

        key = 'test-secret-key'
        real_hmac = hmac_mod.new(key.encode(), content, hashlib.sha256).hexdigest()

        mock_db.get_slide_hmac.return_value = {
            'slide_id': 'S26-0001_A1_S1',
            'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
            'hmac': real_hmac,
            'verified_at': None,
        }
        mock_db.update_slide_verified.return_value = True

        response = ingest_client.get('/admin/ingest/verify/S26-0001_A1_S1')

        assert response.status_code == 200
        body = response.json()
        assert body['verified'] is True
        mock_db.update_slide_verified.assert_called_once_with('S26-0001_A1_S1')

    @patch('large_image_server.routes.ingest.db')
    def test_verify_mismatch(self, mock_db, ingest_client, clinical_root):
        """HMAC doesn't match -> verified: false."""
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True)
        slide_file = slide_dir / 'S26-0001_A1_S1.svs'
        slide_file.write_bytes(b'original content')

        mock_db.get_slide_hmac.return_value = {
            'slide_id': 'S26-0001_A1_S1',
            'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
            'hmac': 'wrong_hmac_value' + '0' * 48,
            'verified_at': None,
        }

        response = ingest_client.get('/admin/ingest/verify/S26-0001_A1_S1')

        assert response.status_code == 200
        body = response.json()
        assert body['verified'] is False
        mock_db.update_slide_verified.assert_not_called()

    @patch('large_image_server.routes.ingest.db')
    def test_verify_slide_not_found(self, mock_db, ingest_client):
        """Unknown slide_id -> 404."""
        mock_db.get_slide_hmac.return_value = None

        response = ingest_client.get('/admin/ingest/verify/NONEXISTENT')
        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /admin/ingest/backfill-hmac tests
# ---------------------------------------------------------------------------

class TestBackfillHmac:

    @patch('large_image_server.routes.ingest.compute_file_hmac')
    @patch('large_image_server.routes.ingest.db')
    def test_backfill_happy_path(self, mock_db, mock_compute, ingest_client, clinical_root):
        """Slides with NULL hmac get computed and stored."""
        # Create slide files on disk
        for name in ('S26-0001_A1_S1.svs', 'S26-0001_A2_S1.svs'):
            d = clinical_root / '2026' / 'S26-0001'
            d.mkdir(parents=True, exist_ok=True)
            (d / name).write_bytes(b'\x00' * 64)

        mock_db.is_configured.return_value = True
        mock_db.list_slides_missing_hmac.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
            {'slide_id': 'S26-0001_A2_S1', 'relative_path': '2026/S26-0001/S26-0001_A2_S1.svs'},
        ]
        mock_compute.return_value = 'b' * 64
        mock_db.update_slide_hmac.return_value = True

        response = ingest_client.post('/admin/ingest/backfill-hmac')

        assert response.status_code == 200
        body = response.json()
        assert body['processed'] == 2
        assert body['skipped'] == []
        assert body['errors'] == []
        assert mock_db.update_slide_hmac.call_count == 2

    @patch('large_image_server.routes.ingest.db')
    def test_backfill_skips_missing_files(self, mock_db, ingest_client, clinical_root):
        """Slide in DB but file not on disk -> skipped."""
        mock_db.is_configured.return_value = True
        mock_db.list_slides_missing_hmac.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
        ]

        response = ingest_client.post('/admin/ingest/backfill-hmac')

        assert response.status_code == 200
        body = response.json()
        assert body['processed'] == 0
        assert len(body['skipped']) == 1
        assert body['skipped'][0]['slideId'] == 'S26-0001_A1_S1'
        assert body['skipped'][0]['reason'] == 'file not found'

    def test_backfill_db_not_configured(self, clinical_root):
        """No --db-url -> 503."""
        from large_image_server import create_app

        app = create_app(
            image_dir=str(clinical_root),
            hmac_key='key',
            storage_clinical_root=clinical_root,
        )
        client = TestClient(app)

        response = client.post('/admin/ingest/backfill-hmac')
        assert response.status_code == 503
        assert 'Database not configured' in response.json()['detail']


# ---------------------------------------------------------------------------
# POST /admin/ingest/verify-all tests
# ---------------------------------------------------------------------------

class TestVerifyAll:

    @patch('large_image_server.routes.ingest.compute_file_hmac')
    @patch('large_image_server.routes.ingest.db')
    def test_verify_all_happy_path(self, mock_db, mock_compute, ingest_client, clinical_root):
        """All slides pass verification."""
        stored_hmac = 'c' * 64
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True, exist_ok=True)
        (slide_dir / 'S26-0001_A1_S1.svs').write_bytes(b'content1')
        (slide_dir / 'S26-0001_A2_S1.svs').write_bytes(b'content2')

        mock_db.is_configured.return_value = True
        mock_db.list_slides_for_verification.return_value = [
            {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
                'hmac': stored_hmac,
                'verified_at': None,
            },
            {
                'slide_id': 'S26-0001_A2_S1',
                'relative_path': '2026/S26-0001/S26-0001_A2_S1.svs',
                'hmac': stored_hmac,
                'verified_at': None,
            },
        ]
        mock_compute.return_value = stored_hmac
        mock_db.update_slide_verified.return_value = True

        response = ingest_client.post('/admin/ingest/verify-all')

        assert response.status_code == 200
        body = response.json()
        assert body['summary']['verified'] == 2
        assert body['summary']['failed'] == 0
        assert body['summary']['missing'] == 0
        assert body['failures'] == []
        assert body['missing'] == []

    @patch('large_image_server.routes.ingest.compute_file_hmac')
    @patch('large_image_server.routes.ingest.db')
    def test_verify_all_detects_mismatch(self, mock_db, mock_compute, ingest_client, clinical_root):
        """Tampered file is reported in failures."""
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True, exist_ok=True)
        (slide_dir / 'S26-0001_A1_S1.svs').write_bytes(b'tampered content')

        mock_db.is_configured.return_value = True
        mock_db.list_slides_for_verification.return_value = [
            {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
                'hmac': 'a' * 64,
                'verified_at': None,
            },
        ]
        mock_compute.return_value = 'b' * 64  # different from stored

        response = ingest_client.post('/admin/ingest/verify-all')

        assert response.status_code == 200
        body = response.json()
        assert body['summary']['verified'] == 0
        assert body['summary']['failed'] == 1
        assert len(body['failures']) == 1
        assert body['failures'][0]['slideId'] == 'S26-0001_A1_S1'
        assert body['failures'][0]['expected'] == 'a' * 64
        assert body['failures'][0]['actual'] == 'b' * 64

    @patch('large_image_server.routes.ingest.db')
    def test_verify_all_handles_missing_file(self, mock_db, ingest_client, clinical_root):
        """Missing file on disk is reported in missing list."""
        mock_db.is_configured.return_value = True
        mock_db.list_slides_for_verification.return_value = [
            {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
                'hmac': 'a' * 64,
                'verified_at': None,
            },
        ]

        response = ingest_client.post('/admin/ingest/verify-all')

        assert response.status_code == 200
        body = response.json()
        assert body['summary']['missing'] == 1
        assert body['summary']['verified'] == 0
        assert len(body['missing']) == 1
        assert body['missing'][0]['slideId'] == 'S26-0001_A1_S1'


# ---------------------------------------------------------------------------
# POST /admin/ingest/backfill-metadata tests
# ---------------------------------------------------------------------------

class TestBackfillMetadata:

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_backfill_metadata_happy_path(self, mock_db, mock_meta, ingest_client, clinical_root):
        """Slides with NULL metadata get populated from files."""
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True, exist_ok=True)
        (slide_dir / 'S26-0001_A1_S1.svs').write_bytes(b'\x00' * 64)
        (slide_dir / 'S26-0001_A1_S2.svs').write_bytes(b'\x00' * 64)

        mock_db.is_configured.return_value = True
        mock_db.list_slides_missing_metadata.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
            {'slide_id': 'S26-0001_A1_S2', 'relative_path': '2026/S26-0001/S26-0001_A1_S2.svs'},
        ]
        mock_meta.return_value = {
            'width_px': 50000,
            'height_px': 40000,
            'magnification': 40.0,
            'mpp_x': 0.25,
            'mpp_y': 0.25,
            'scanner': None,
        }
        mock_db.update_slide_metadata.return_value = True

        response = ingest_client.post('/admin/ingest/backfill-metadata')

        assert response.status_code == 200
        body = response.json()
        assert body['processed'] == 2
        assert body['skipped'] == []
        assert body['errors'] == []
        assert mock_db.update_slide_metadata.call_count == 2
        call_kwargs = mock_db.update_slide_metadata.call_args_list[0]
        assert call_kwargs.kwargs['width_px'] == 50000

    @patch('large_image_server.routes.ingest.db')
    def test_backfill_metadata_skips_missing_files(self, mock_db, ingest_client, clinical_root):
        """Slide in DB but file not on disk -> skipped."""
        mock_db.is_configured.return_value = True
        mock_db.list_slides_missing_metadata.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
        ]

        response = ingest_client.post('/admin/ingest/backfill-metadata')

        assert response.status_code == 200
        body = response.json()
        assert body['processed'] == 0
        assert len(body['skipped']) == 1
        assert body['skipped'][0]['reason'] == 'file not found'

    @patch('large_image_server.routes.ingest._extract_metadata')
    @patch('large_image_server.routes.ingest.db')
    def test_backfill_metadata_skips_no_dimensions(self, mock_db, mock_meta, ingest_client, clinical_root):
        """File exists but large_image cannot extract dimensions -> skipped."""
        slide_dir = clinical_root / '2026' / 'S26-0001'
        slide_dir.mkdir(parents=True, exist_ok=True)
        (slide_dir / 'S26-0001_A1_S1.svs').write_bytes(b'\x00' * 64)

        mock_db.is_configured.return_value = True
        mock_db.list_slides_missing_metadata.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
        ]
        mock_meta.return_value = {}  # no dimensions extracted

        response = ingest_client.post('/admin/ingest/backfill-metadata')

        assert response.status_code == 200
        body = response.json()
        assert body['processed'] == 0
        assert len(body['skipped']) == 1
        assert body['skipped'][0]['reason'] == 'no dimensions extracted'

    def test_backfill_metadata_db_not_configured(self, clinical_root):
        """No --db-url -> 503."""
        from large_image_server import create_app

        app = create_app(
            image_dir=str(clinical_root),
            storage_clinical_root=clinical_root,
        )
        client = TestClient(app)

        response = client.post('/admin/ingest/backfill-metadata')
        assert response.status_code == 503
        assert 'Database not configured' in response.json()['detail']
