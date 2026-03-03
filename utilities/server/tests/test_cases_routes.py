"""Tests for case management routes (DB-backed).

Tests mock ``large_image_server.db`` functions so the route code
sees database-backed responses.
"""

from unittest.mock import patch

import pytest


class TestCasesRoutes:
    """Test case routes backed by database.

    Patches ``large_image_server.db`` functions at the module level so
    the route code sees db responses.
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
        """Patch db module so all routes see DB responses."""
        from large_image_server import db as _db

        _patches = [
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
