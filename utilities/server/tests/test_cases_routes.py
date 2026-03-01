"""Tests for case management routes — both JSON-backed and DB-backed modes.

The ``client`` fixture from conftest.py provides a JSON/filesystem-based app.
DB-backed tests mock ``large_image_server.db`` functions and set
``db.is_configured`` to return True.
"""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_cases_json(image_dir: Path, cases: list[dict]) -> None:
    """Write a cases.json file into the image directory."""
    data = {'version': '1.0', 'cases': cases}
    (image_dir / 'cases.json').write_text(json.dumps(data))


SAMPLE_CASE = {
    'caseId': 'S26-0001',
    'patientName': 'DOE, JANE',
    'patientId': 'PT-001',
    'patientDob': '1970-01-01',
    'patientSex': 'F',
    'accessionDate': '2026-01-15',
    'clinicalHistory': 'Test',
    'specimenType': 'Breast',
    'diagnosis': 'IDC grade 2',
    'status': 'pending_review',
    'priority': 'routine',
    'slides': [
        {
            'slideId': 'S26-0001_A1_S1',
            'filename': 'S26-0001_A1_S1.svs',
            'stain': 'H&E',
        },
    ],
}

SAMPLE_CASE_2 = {
    'caseId': 'S26-0042',
    'patientName': 'SMITH, JOHN',
    'patientId': 'PT-042',
    'patientDob': '1980-05-20',
    'patientSex': 'M',
    'accessionDate': '2026-02-01',
    'clinicalHistory': 'Routine screening',
    'specimenType': 'Skin',
    'diagnosis': 'BCC',
    'status': 'pending_review',
    'priority': 'routine',
    'slides': [
        {
            'slideId': 'S26-0042_A1_S1',
            'filename': 'S26-0042_A1_S1.svs',
            'stain': 'H&E',
        },
    ],
}


# ===================================================================
# JSON-backed mode tests (no database)
# ===================================================================

class TestCasesJsonMode:
    """Test case routes backed by cases.json (legacy mode)."""

    @pytest.fixture(autouse=True)
    def setup_cases(self, tmp_image_dir):
        _write_cases_json(tmp_image_dir, [SAMPLE_CASE, SAMPLE_CASE_2])
        # Create the slide files so source_manager can resolve them
        case_dir = tmp_image_dir / 'S26-0001'
        case_dir.mkdir()
        (case_dir / 'S26-0001_A1_S1.svs').write_bytes(b'\x00')
        case_dir2 = tmp_image_dir / 'S26-0042'
        case_dir2.mkdir()
        (case_dir2 / 'S26-0042_A1_S1.svs').write_bytes(b'\x00')
        # Clear the cases.json cache between tests
        import large_image_server.routes.cases as _mod
        _mod._cases_cache = None
        _mod._cases_cache_mtime = 0

    def test_list_cases(self, client):
        response = client.get('/cases')
        assert response.status_code == 200
        cases = response.json()
        assert len(cases) == 2
        case_ids = [c['caseId'] for c in cases]
        assert 'S26-0001' in case_ids
        assert 'S26-0042' in case_ids

    def test_get_case(self, client):
        response = client.get('/cases/S26-0001')
        assert response.status_code == 200
        data = response.json()
        assert data['caseId'] == 'S26-0001'
        assert len(data['slides']) == 1

    def test_get_case_not_found(self, client):
        response = client.get('/cases/NONEXISTENT')
        assert response.status_code == 404

    def test_get_case_slides(self, client):
        response = client.get('/cases/S26-0001/slides')
        assert response.status_code == 200
        slides = response.json()
        assert len(slides) == 1
        assert slides[0]['slideId'] == 'S26-0001_A1_S1'

    def test_get_slide(self, client):
        response = client.get('/slides/S26-0001_A1_S1')
        assert response.status_code == 200
        data = response.json()
        assert data['slideId'] == 'S26-0001_A1_S1'
        assert 'caseContext' in data
        assert data['caseContext']['caseId'] == 'S26-0001'

    def test_get_slide_not_found(self, client):
        response = client.get('/slides/NONEXISTENT')
        assert response.status_code == 404

    def test_get_slide_file_path(self, client):
        response = client.get('/slides/S26-0001_A1_S1/file')
        assert response.status_code == 200
        data = response.json()
        assert data['slideId'] == 'S26-0001_A1_S1'
        assert 'resolvedPath' in data

    def test_worklist(self, client):
        response = client.get('/worklist')
        assert response.status_code == 200
        worklist = response.json()
        assert len(worklist) == 2
        assert 'slides' in worklist[0]

    def test_worklist_filter_status(self, client):
        response = client.get('/worklist?status=signed_out')
        assert response.status_code == 200
        assert response.json() == []

    def test_worklist_filter_priority(self, client):
        response = client.get('/worklist?priority=stat')
        assert response.status_code == 200
        assert response.json() == []

    def test_get_slide_label(self, client):
        response = client.get('/slides/S26-0001_A1_S1/label')
        assert response.status_code == 200
        assert response.headers['content-type'] in ['image/jpeg', 'image/png']

    def test_get_slide_thumbnail(self, client):
        response = client.get('/slides/S26-0001_A1_S1/thumbnail')
        assert response.status_code == 200

    def test_get_slide_associated(self, client):
        response = client.get('/slides/S26-0001_A1_S1/associated')
        assert response.status_code == 200
        data = response.json()
        assert 'thumbnail' in data
        assert 'label' in data
        assert 'macro' in data

    def test_warm_status(self, client):
        response = client.get('/warm/status')
        assert response.status_code == 200

    def test_search_cases(self, client):
        response = client.get('/cases/search?q=0001')
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 1
        assert results[0]['caseId'] == 'S26-0001'
        assert results[0]['slideCount'] == 1

    def test_search_cases_returns_all_matches(self, client):
        response = client.get('/cases/search?q=S26')
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 2

    def test_search_cases_no_match(self, client):
        response = client.get('/cases/search?q=NONEXISTENT')
        assert response.status_code == 200
        assert response.json() == []

    def test_search_cases_missing_query(self, client):
        response = client.get('/cases/search')
        assert response.status_code == 422


# ===================================================================
# DB-backed mode tests
# ===================================================================

class TestCasesDBMode:
    """Test case routes backed by database.

    Patches ``large_image_server.db`` functions at the module level so
    the route code sees db.is_configured() == True.
    """

    DB_CASE = {
        'caseId': 'S26-0001',
        'patientName': 'MARTINEZ, ELENA R',
        'patientId': 'PT-2026-0001',
        'patientDob': '1965-03-14',
        'patientSex': 'F',
        'accessionDate': '2026-01-15',
        'clinicalHistory': '56 y/o female',
        'specimenType': 'Breast',
        'diagnosis': 'IDC grade 2',
        'status': 'pending_review',
        'priority': 'routine',
        'slides': [
            {
                'slideId': 'S26-0001_A1_S1',
                'filename': 'S26-0001_A1_S1.svs',
                'stain': 'H&E',
                'levelLabel': 'S1',
                'partLabel': 'A',
                'blockLabel': '1',
            },
        ],
    }

    DB_SLIDE_ROW = {
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
    }

    DB_SLIDE_CONTEXT = {
        'slideId': 'S26-0001_A1_S1',
        'filename': 'S26-0001_A1_S1.svs',
        'stain': 'H&E',
        'levelLabel': 'S1',
        'partLabel': 'A',
        'blockLabel': '1',
        'caseContext': {
            'caseId': 'S26-0001',
            'patientName': 'MARTINEZ, ELENA R',
            'patientId': 'PT-2026-0001',
            'patientDob': '1965-03-14',
            'diagnosis': 'IDC grade 2',
            'status': 'pending_review',
            'priority': 'routine',
        },
    }

    @pytest.fixture(autouse=True)
    def _mock_db(self):
        """Patch db module so all routes see DB mode."""
        # The cases.py module imports db as ``from .. import db`` so we
        # patch the db module's functions directly.
        from large_image_server import db as _db

        _patches = [
            patch.object(_db, 'is_configured', return_value=True),
            patch.object(_db, 'list_cases', return_value=[{
                'caseId': 'S26-0001',
                'patientName': 'MARTINEZ, ELENA R',
                'patientId': 'PT-2026-0001',
                'accessionDate': '2026-01-15',
                'diagnosis': 'IDC grade 2',
                'specimenType': 'Breast',
                'status': 'pending_review',
                'priority': 'routine',
                'slideCount': 1,
            }]),
            patch.object(_db, 'get_case', side_effect=lambda cid: (
                self.DB_CASE if cid == 'S26-0001' else None
            )),
            patch.object(_db, 'get_case_slides', side_effect=lambda cid: (
                self.DB_CASE['slides'] if cid == 'S26-0001' else None
            )),
            patch.object(_db, 'get_slide_with_context', side_effect=lambda sid: (
                self.DB_SLIDE_CONTEXT if sid == 'S26-0001_A1_S1' else None
            )),
            patch.object(_db, 'get_slide_by_id', side_effect=lambda sid: (
                self.DB_SLIDE_ROW if sid == 'S26-0001_A1_S1' else None
            )),
            patch.object(_db, 'get_worklist_cases', return_value=[{
                'caseId': 'S26-0001',
                'patientName': 'MARTINEZ, ELENA R',
                'patientId': 'PT-2026-0001',
                'accessionDate': '2026-01-15',
                'diagnosis': 'IDC grade 2',
                'specimenType': 'Breast',
                'status': 'pending_review',
                'priority': 'routine',
                'slideCount': 1,
                'slides': [{
                    'slideId': 'S26-0001_A1_S1',
                    'stain': 'H&E',
                    'filename': 'S26-0001_A1_S1.svs',
                }],
            }]),
            patch.object(_db, 'search_cases', side_effect=lambda q, limit=20: [
                c for c in [{
                    'caseId': 'S26-0001',
                    'patientName': 'MARTINEZ, ELENA R',
                    'patientId': 'PT-2026-0001',
                    'accessionDate': '2026-01-15',
                    'diagnosis': 'IDC grade 2',
                    'specimenType': 'Breast',
                    'status': 'pending_review',
                    'priority': 'routine',
                    'slideCount': 1,
                }] if q.lower() in c['caseId'].lower()
            ][:limit]),
        ]

        for p in _patches:
            p.start()
        yield
        for p in _patches:
            p.stop()

    def test_list_cases(self, client):
        response = client.get('/cases')
        assert response.status_code == 200
        cases = response.json()
        assert len(cases) == 1
        assert cases[0]['caseId'] == 'S26-0001'
        assert cases[0]['patientName'] == 'MARTINEZ, ELENA R'

    def test_get_case(self, client):
        response = client.get('/cases/S26-0001')
        assert response.status_code == 200
        data = response.json()
        assert data['caseId'] == 'S26-0001'
        assert len(data['slides']) == 1

    def test_get_case_not_found(self, client):
        response = client.get('/cases/NONEXISTENT')
        assert response.status_code == 404

    def test_get_case_slides(self, client):
        response = client.get('/cases/S26-0001/slides')
        assert response.status_code == 200
        slides = response.json()
        assert len(slides) == 1

    def test_get_case_slides_not_found(self, client):
        response = client.get('/cases/NONEXISTENT/slides')
        assert response.status_code == 404

    def test_get_slide(self, client):
        response = client.get('/slides/S26-0001_A1_S1')
        assert response.status_code == 200
        data = response.json()
        assert data['slideId'] == 'S26-0001_A1_S1'
        assert data['caseContext']['caseId'] == 'S26-0001'

    def test_get_slide_not_found(self, client):
        response = client.get('/slides/NONEXISTENT')
        assert response.status_code == 404

    def test_get_slide_file_path(self, client):
        response = client.get('/slides/S26-0001_A1_S1/file')
        assert response.status_code == 200
        data = response.json()
        assert data['slideId'] == 'S26-0001_A1_S1'
        assert data['imagePath'] == '2026/S26-0001/S26-0001_A1_S1.svs'

    def test_worklist(self, client):
        response = client.get('/worklist')
        assert response.status_code == 200
        worklist = response.json()
        assert len(worklist) == 1
        assert worklist[0]['slides'][0]['slideId'] == 'S26-0001_A1_S1'

    def test_search_cases(self, client):
        response = client.get('/cases/search?q=S26')
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 1
        assert results[0]['caseId'] == 'S26-0001'

    def test_search_cases_no_match(self, client):
        response = client.get('/cases/search?q=NONEXISTENT')
        assert response.status_code == 200
        assert response.json() == []

    def test_search_cases_missing_query(self, client):
        response = client.get('/cases/search')
        assert response.status_code == 422
