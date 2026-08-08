from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_section_demand_prediction_returns_nonnegative_bounded_forecast() -> None:
    response = client.post(
        "/internal/v1/section-demand/predict",
        json={
            "data": {
                "feature_schema_version": "v1",
                "observations": [
                    {
                        "cohort_size": 72,
                        "enrolled_count": 70,
                        "section_count": 2,
                        "offered_capacity": 80,
                        "year_level": 1,
                        "semester": "1st",
                    },
                    {
                        "cohort_size": 76,
                        "enrolled_count": 75,
                        "section_count": 2,
                        "offered_capacity": 80,
                        "year_level": 1,
                        "semester": "1st",
                    },
                    {
                        "cohort_size": 81,
                        "enrolled_count": 79,
                        "section_count": 2,
                        "offered_capacity": 80,
                        "year_level": 1,
                        "semester": "1st",
                    },
                    {
                        "cohort_size": 86,
                        "enrolled_count": 84,
                        "section_count": 3,
                        "offered_capacity": 120,
                        "year_level": 1,
                        "semester": "1st",
                    },
                ],
                "targets": [
                    {
                        "key": "bsit-1-fundacc",
                        "cohort_size": 90,
                        "section_count": 3,
                        "recommended_capacity": 40,
                        "year_level": 1,
                        "semester": "1st",
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["feature_schema_version"] == "v1"
    assert body["model_version"] == "section-demand-rf-v1"
    assert body["strategy"] == "random_forest"
    forecast = body["forecasts"][0]
    assert forecast["key"] == "bsit-1-fundacc"
    assert forecast["predicted_demand"] >= 0
    assert forecast["confidence_lower"] >= 0
    assert forecast["confidence_lower"] <= forecast["predicted_demand"]
    assert forecast["confidence_upper"] >= forecast["predicted_demand"]
    assert forecast["suggested_section_count"] >= 1


def test_section_demand_prediction_falls_back_to_source_demand_when_history_is_sparse() -> None:
    response = client.post(
        "/internal/v1/section-demand/predict",
        json={
            "data": {
                "feature_schema_version": "v1",
                "observations": [
                    {
                        "cohort_size": 40,
                        "enrolled_count": 38,
                        "section_count": 1,
                        "offered_capacity": 40,
                        "year_level": 2,
                        "semester": "2nd",
                    }
                ],
                "targets": [
                    {
                        "key": "bsit-2-itplus",
                        "cohort_size": 42,
                        "section_count": 1,
                        "recommended_capacity": 40,
                        "year_level": 2,
                        "semester": "2nd",
                    }
                ],
            }
        },
    )

    assert response.status_code == 200
    body = response.json()["data"]
    assert body["strategy"] == "historical_baseline"
    assert body["forecasts"][0]["predicted_demand"] == 38.0
