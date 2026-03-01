"""Tests for the database access layer (large_image_server.db).

All tests mock the connection pool so no real PostgreSQL is needed.
"""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from large_image_server import db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_slide_row(
    slide_id='S26-0001_A1_S1',
    relative_path='2026/S26-0001/S26-0001_A1_S1.svs',
    fmt='svs',
    stain='H&E',
    case_id='S26-0001',
):
    """Build a dict matching the slide query column set."""
    return {
        'slide_id': slide_id,
        'relative_path': relative_path,
        'format': fmt,
        'stain': stain,
        'level_label': 'S1',
        'magnification': None,
        'width_px': None,
        'height_px': None,
        'mpp_x': None,
        'mpp_y': None,
        'case_id': case_id,
    }


def _make_case_row(
    case_id='S26-0001',
    collection='clinical',
    specimen_type='Breast, left, lumpectomy',
    status='pending_review',
    priority='routine',
    slide_count=2,
):
    return {
        'case_id': case_id,
        'specimen_type': specimen_type,
        'clinical_history': '58 y/o female',
        'accession_date': date(2026, 1, 15),
        'status': status,
        'priority': priority,
        'patient_mrn': 'XN-000024',
        'patient_name': 'Thisovau Oquuski',
        'patient_dob': date(1967, 8, 24),
        'patient_sex': 'F',
        'slide_count': slide_count,
    }


# ---------------------------------------------------------------------------
# is_configured()
# ---------------------------------------------------------------------------

class TestIsConfigured:

    def test_false_without_db_url(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.is_configured() is False

    @patch.object(db, '_get_pool')
    def test_true_with_pool(self, mock_pool):
        mock_pool.return_value = MagicMock()
        assert db.is_configured() is True


# ---------------------------------------------------------------------------
# get_slide_by_id()
# ---------------------------------------------------------------------------

class TestGetSlideById:

    @patch.object(db, '_fetchone')
    def test_found(self, mock_fetch):
        row = _make_slide_row()
        mock_fetch.return_value = row
        result = db.get_slide_by_id('S26-0001_A1_S1')
        assert result['slide_id'] == 'S26-0001_A1_S1'
        assert result['relative_path'] == '2026/S26-0001/S26-0001_A1_S1.svs'

    @patch.object(db, '_fetchone')
    def test_not_found(self, mock_fetch):
        mock_fetch.return_value = None
        assert db.get_slide_by_id('NONEXISTENT') is None

    def test_returns_none_without_pool(self):
        """When no DB is configured, returns None gracefully."""
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.get_slide_by_id('S26-0001_A1_S1') is None


# ---------------------------------------------------------------------------
# resolve_slide_path()
# ---------------------------------------------------------------------------

class TestResolveSlidePathStrategy:
    """Test the multi-strategy lookup in resolve_slide_path()."""

    @patch.object(db, 'get_slide_by_id')
    def test_exact_slide_id(self, mock_get):
        """Strategy 1: exact slide_id match."""
        row = _make_slide_row()
        mock_get.return_value = row
        result = db.resolve_slide_path('S26-0001_A1_S1')
        assert result is row
        mock_get.assert_called_once_with('S26-0001_A1_S1')

    @patch.object(db, '_fetchone')
    @patch.object(db, 'get_slide_by_id')
    def test_filename_stem_extraction(self, mock_get, mock_fetch):
        """Strategy 2: extract filename stem from path-style ID."""
        row = _make_slide_row()
        # First call (exact) returns None; stem extraction triggers second call
        mock_get.side_effect = [None, row]
        mock_fetch.return_value = None  # strategy 3 shouldn't be needed

        result = db.resolve_slide_path('S26-0001/S26-0001_A1_S1.svs')
        assert result is row
        # Called twice: once with full path, once with stem
        assert mock_get.call_count == 2
        assert mock_get.call_args_list[1].args[0] == 'S26-0001_A1_S1'

    @patch.object(db, '_fetchone')
    @patch.object(db, 'get_slide_by_id')
    def test_ome_tiff_stem_extraction(self, mock_get, mock_fetch):
        """Strategy 2 handles compound extensions like .ome.tiff."""
        row = _make_slide_row(
            slide_id='S26-0004_A3_S1',
            relative_path='2026/S26-0004/S26-0004_A3_S1.ome.tiff',
        )
        mock_get.side_effect = [None, row]
        mock_fetch.return_value = None

        result = db.resolve_slide_path('S26-0004/S26-0004_A3_S1.ome.tiff')
        assert result is row
        assert mock_get.call_args_list[1].args[0] == 'S26-0004_A3_S1'

    @patch.object(db, '_fetchone')
    @patch.object(db, 'get_slide_by_id')
    def test_relative_path_suffix_fallback(self, mock_get, mock_fetch):
        """Strategy 3: LIKE match on relative_path suffix."""
        row = _make_slide_row()
        mock_get.return_value = None  # strategies 1 & 2 miss
        mock_fetch.return_value = row  # strategy 3 hits

        result = db.resolve_slide_path('S26-0001/S26-0001_A1_S1.svs')
        assert result is row
        # _fetchone called with LIKE query
        call_args = mock_fetch.call_args
        assert 'LIKE' in call_args.args[0]

    @patch.object(db, '_fetchone')
    @patch.object(db, 'get_slide_by_id')
    def test_all_strategies_miss(self, mock_get, mock_fetch):
        """All strategies miss → returns None."""
        mock_get.return_value = None
        mock_fetch.return_value = None

        result = db.resolve_slide_path('totally/unknown.svs')
        assert result is None


# ---------------------------------------------------------------------------
# list_cases()
# ---------------------------------------------------------------------------

class TestListCases:

    @patch.object(db, '_get_case_diagnosis', return_value='Invasive ductal carcinoma')
    @patch.object(db, '_fetchall')
    def test_returns_formatted_cases(self, mock_fetch, mock_diag):
        mock_fetch.return_value = [_make_case_row()]

        cases = db.list_cases()
        assert len(cases) == 1
        c = cases[0]
        assert c['caseId'] == 'S26-0001'
        assert c['patientName'] == 'Thisovau Oquuski'
        assert c['patientId'] == 'XN-000024'
        assert c['slideCount'] == 2
        assert c['status'] == 'pending_review'

    @patch.object(db, '_get_case_diagnosis', return_value=None)
    @patch.object(db, '_fetchall')
    def test_status_filter(self, mock_fetch, mock_diag):
        mock_fetch.return_value = []
        db.list_cases(status='signed_out')
        sql = mock_fetch.call_args.args[0]
        assert 'c.status = %s' in sql

    @patch.object(db, '_get_case_diagnosis', return_value=None)
    @patch.object(db, '_fetchall')
    def test_priority_filter(self, mock_fetch, mock_diag):
        mock_fetch.return_value = []
        db.list_cases(priority='stat')
        sql = mock_fetch.call_args.args[0]
        assert 'c.priority = %s' in sql

    def test_returns_empty_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.list_cases() == []


# ---------------------------------------------------------------------------
# get_case()
# ---------------------------------------------------------------------------

class TestGetCase:

    @patch.object(db, '_fetchall')
    @patch.object(db, '_fetchone')
    def test_returns_full_case(self, mock_one, mock_all):
        mock_one.return_value = {
            'uuid': 'abc-123',
            'case_id': 'S26-0001',
            'collection': 'clinical',
            'specimen_type': 'Breast',
            'clinical_history': 'History',
            'accession_date': date(2026, 1, 15),
            'status': 'pending_review',
            'priority': 'routine',
            'patient_mrn': 'XN-000024',
            'patient_name': 'Thisovau Oquuski',
            'patient_dob': date(1967, 8, 24),
            'patient_sex': 'F',
        }
        mock_all.return_value = [
            {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
                'format': 'svs',
                'stain': 'H&E',
                'level_label': 'S1',
                'magnification': None,
                'width_px': None,
                'height_px': None,
                'mpp_x': None,
                'mpp_y': None,
                'part_label': 'A',
                'final_diagnosis': 'IDC grade 2',
                'block_label': '1',
            },
        ]

        case = db.get_case('S26-0001')
        assert case is not None
        assert case['caseId'] == 'S26-0001'
        assert case['patientName'] == 'Thisovau Oquuski'
        assert case['patientId'] == 'XN-000024'
        assert case['patientDob'] == '1967-08-24'
        assert case['patientSex'] == 'F'
        assert len(case['slides']) == 1
        assert case['slides'][0]['slideId'] == 'S26-0001_A1_S1'
        assert case['slides'][0]['filename'] == 'S26-0001_A1_S1.svs'
        assert case['diagnosis'] == 'IDC grade 2'

    @patch.object(db, '_fetchone')
    def test_not_found(self, mock_one):
        mock_one.return_value = None
        assert db.get_case('NONEXISTENT') is None


# ---------------------------------------------------------------------------
# get_slide_with_context()
# ---------------------------------------------------------------------------

class TestGetSlideWithContext:

    @patch.object(db, '_fetchone')
    def test_returns_slide_with_case(self, mock_one):
        mock_one.return_value = {
            'slide_id': 'S26-0001_A1_S1',
            'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
            'format': 'svs',
            'stain': 'H&E',
            'level_label': 'S1',
            'magnification': None,
            'width_px': None,
            'height_px': None,
            'mpp_x': None,
            'mpp_y': None,
            'case_id': 'S26-0001',
            'status': 'pending_review',
            'priority': 'routine',
            'patient_mrn': 'XN-000024',
            'patient_name': 'Thisovau Oquuski',
            'patient_dob': date(1967, 8, 24),
            'patient_sex': 'F',
            'part_label': 'A',
            'final_diagnosis': 'IDC',
            'block_label': '1',
        }

        result = db.get_slide_with_context('S26-0001_A1_S1')
        assert result['slideId'] == 'S26-0001_A1_S1'
        assert result['caseContext']['caseId'] == 'S26-0001'
        assert result['caseContext']['patientName'] == 'Thisovau Oquuski'
        assert result['caseContext']['patientId'] == 'XN-000024'
        assert result['caseContext']['patientDob'] == '1967-08-24'
        assert result['filename'] == 'S26-0001_A1_S1.svs'

    @patch.object(db, '_fetchone')
    def test_not_found(self, mock_one):
        mock_one.return_value = None
        assert db.get_slide_with_context('MISSING') is None


# ---------------------------------------------------------------------------
# get_worklist_cases()
# ---------------------------------------------------------------------------

class TestGetWorklistCases:

    @patch.object(db, '_fetchall')
    @patch.object(db, 'list_cases')
    def test_includes_slides(self, mock_list, mock_fetch):
        mock_list.return_value = [{
            'caseId': 'S26-0001',
            'patientName': 'DOE',
            'patientId': 'PT-001',
            'accessionDate': '2026-01-15',
            'diagnosis': 'IDC',
            'specimenType': 'Breast',
            'status': 'pending_review',
            'priority': 'routine',
            'slideCount': 1,
        }]
        mock_fetch.return_value = [{
            'slide_id': 'S26-0001_A1_S1',
            'stain': 'H&E',
            'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
        }]

        worklist = db.get_worklist_cases()
        assert len(worklist) == 1
        assert worklist[0]['slides'][0]['slideId'] == 'S26-0001_A1_S1'
        assert worklist[0]['slides'][0]['filename'] == 'S26-0001_A1_S1.svs'


# ---------------------------------------------------------------------------
# list_slides_missing_hmac()
# ---------------------------------------------------------------------------

class TestListSlidesMissingHmac:

    @patch.object(db, '_fetchall')
    def test_returns_null_hmac_slides(self, mock_fetch):
        mock_fetch.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
            {'slide_id': 'S26-0001_A2_S1', 'relative_path': '2026/S26-0001/S26-0001_A2_S1.svs'},
        ]

        result = db.list_slides_missing_hmac()
        assert len(result) == 2
        assert result[0]['slide_id'] == 'S26-0001_A1_S1'
        sql = mock_fetch.call_args.args[0]
        assert 'hmac IS NULL' in sql

    def test_returns_empty_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.list_slides_missing_hmac() == []


# ---------------------------------------------------------------------------
# list_slides_for_verification()
# ---------------------------------------------------------------------------

class TestListSlidesForVerification:

    @patch.object(db, '_fetchall')
    def test_returns_unverified_slides(self, mock_fetch):
        mock_fetch.return_value = [
            {
                'slide_id': 'S26-0001_A1_S1',
                'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs',
                'hmac': 'a' * 64,
                'verified_at': None,
            },
        ]

        result = db.list_slides_for_verification()
        assert len(result) == 1
        sql = mock_fetch.call_args.args[0]
        assert 'verified_at IS NULL' in sql

    @patch.object(db, '_fetchall')
    def test_stale_hours_filter(self, mock_fetch):
        mock_fetch.return_value = []

        db.list_slides_for_verification(stale_hours=24)
        sql = mock_fetch.call_args.args[0]
        assert 'make_interval' in sql
        assert mock_fetch.call_args.args[1] == (24,)

    def test_returns_empty_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.list_slides_for_verification() == []


# ---------------------------------------------------------------------------
# update_slide_hmac()
# ---------------------------------------------------------------------------

class TestUpdateSlideHmac:

    @patch.object(db, '_get_pool')
    def test_updates_hmac(self, mock_pool):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.rowcount = 1
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_cur.__enter__ = lambda s: mock_cur
        mock_cur.__exit__ = MagicMock(return_value=False)
        mock_conn.cursor.return_value = mock_cur
        mock_pool.return_value.connection.return_value = mock_conn

        result = db.update_slide_hmac('S26-0001_A1_S1', 'a' * 64)
        assert result is True
        mock_cur.execute.assert_called_once()
        sql = mock_cur.execute.call_args.args[0]
        assert 'UPDATE wsi.slides SET hmac' in sql

    def test_returns_false_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.update_slide_hmac('X', 'a' * 64) is False


# ---------------------------------------------------------------------------
# list_slides_missing_metadata()
# ---------------------------------------------------------------------------

class TestListSlidesMissingMetadata:

    @patch.object(db, '_fetchall')
    def test_returns_null_metadata_slides(self, mock_fetch):
        mock_fetch.return_value = [
            {'slide_id': 'S26-0001_A1_S1', 'relative_path': '2026/S26-0001/S26-0001_A1_S1.svs'},
        ]

        result = db.list_slides_missing_metadata()
        assert len(result) == 1
        sql = mock_fetch.call_args.args[0]
        assert 'width_px IS NULL' in sql

    def test_returns_empty_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.list_slides_missing_metadata() == []


# ---------------------------------------------------------------------------
# update_slide_metadata()
# ---------------------------------------------------------------------------

class TestUpdateSlideMetadata:

    @patch.object(db, '_get_pool')
    def test_updates_metadata(self, mock_pool):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.rowcount = 1
        mock_conn.__enter__ = lambda s: mock_conn
        mock_conn.__exit__ = MagicMock(return_value=False)
        mock_cur.__enter__ = lambda s: mock_cur
        mock_cur.__exit__ = MagicMock(return_value=False)
        mock_conn.cursor.return_value = mock_cur
        mock_pool.return_value.connection.return_value = mock_conn

        result = db.update_slide_metadata(
            'S26-0001_A1_S1',
            width_px=50000,
            height_px=40000,
            magnification=40.0,
            mpp_x=0.25,
            mpp_y=0.25,
        )
        assert result is True
        mock_cur.execute.assert_called_once()
        sql = mock_cur.execute.call_args.args[0]
        assert 'UPDATE wsi.slides' in sql
        assert 'width_px' in sql
        params = mock_cur.execute.call_args.args[1]
        assert params[0] == 50000  # width_px
        assert params[1] == 40000  # height_px

    def test_returns_false_without_pool(self):
        from large_image_server.config import configure_settings
        configure_settings(image_dir='/tmp')
        assert db.update_slide_metadata('X', width_px=100) is False
