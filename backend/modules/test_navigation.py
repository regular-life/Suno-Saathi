import time
from unittest.mock import MagicMock

import pytest

import modules.navigation as nav_module
from core.config import CONFIG
from modules.navigation import NavigationHandler


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    # Ensure we don’t accidentally hit the real API
    monkeypatch.setattr(CONFIG.API_KEYS, "GOOGLE", "test_key", raising=False)

    class DummyClient:
        def __init__(self, key):
            self.key = key

        # placeholders; tests will replace these
        def directions(self, *args, **kwargs):
            raise NotImplementedError

        def geocode(self, *args, **kwargs):
            raise NotImplementedError

        def places(self, *args, **kwargs):
            raise NotImplementedError

        def places_nearby(self, *args, **kwargs):
            raise NotImplementedError

    # Swap out the real googlemaps.Client
    monkeypatch.setattr(nav_module.googlemaps, "Client", DummyClient)


def test_is_coordinates_with_dict():
    handler = NavigationHandler()
    assert handler._is_coordinates({"lat": 12.3, "lng": 45.6})


@pytest.mark.parametrize(
    "loc,expected",
    [
        ("12.3,45.6", True),
        ("-90,180", True),
        ("91,0", False),
        ("12.3;45.6", False),
        ("foo,bar", False),
        (None, False),
    ],
)
def test_is_coordinates_string(loc, expected):
    handler = NavigationHandler()
    assert handler._is_coordinates(loc) is expected


def test_process_places_response_empty_and_missing_results():
    handler = NavigationHandler()
    # completely empty
    out1 = handler._process_places_response({})
    assert out1 == {"status": "ZERO_RESULTS", "places": []}
    # missing results key
    out2 = handler._process_places_response({"status": "OK"})
    assert out2 == {"status": "ZERO_RESULTS", "places": []}


def test_process_places_response_full():
    handler = NavigationHandler()
    raw = {
        "status": "OK",
        "results": [
            {
                "place_id": "p1",
                "name": "Test Place",
                "vicinity": "123 Main St",
                "geometry": {"location": {"lat": 1.0, "lng": 2.0}},
                "rating": 4.5,
                "user_ratings_total": 100,
                "types": ["restaurant"],
                "price_level": 2,
                "business_status": "OPERATIONAL",
                "opening_hours": {"open_now": True},
                "permanently_closed": False,
                "photos": [
                    {"photo_reference": "a"},
                    {"photo_reference": "b"},
                    {"photo_reference": "c"},
                    {"photo_reference": "d"},
                ],
            }
        ],
    }
    out = handler._process_places_response(raw)
    assert out["status"] == "OK"
    assert len(out["places"]) == 1
    p = out["places"][0]
    # check that only first 3 photos were kept
    assert p["photos"] == ["a", "b", "c"]
    # all other fields mapped correctly
    assert p["place_id"] == "p1"
    assert p["name"] == "Test Place"
    assert p["address"] == "123 Main St"
    assert p["location"] == {"lat": 1.0, "lng": 2.0}
    assert p["rating"] == 4.5
    assert p["user_ratings_total"] == 100
    assert p["types"] == ["restaurant"]
    assert p["price_level"] == 2
    assert p["business_status"] == "OPERATIONAL"
    assert p["opening_hours"] == {"open_now": True}
    assert p["permanently_closed"] is False


def test_get_directions_valid_and_invalid_mode(monkeypatch):
    handler = NavigationHandler()
    mock = MagicMock(return_value={"foo": "bar"})
    handler.client.directions = mock

    # valid mode
    out = handler.get_directions("A", "B", mode="walking")
    mock.assert_called_with(
        origin="A",
        destination="B",
        mode="walking",
        waypoints=None,
        departure_time=None,
        arrival_time=None,
        alternatives=True,
        language="en",
        units="metric",
    )
    assert out == {"foo": "bar"}

    # invalid mode falls back to driving
    mock.reset_mock()
    out2 = handler.get_directions("A", "B", mode="flying")
    mock.assert_called_with(
        origin="A",
        destination="B",
        mode="driving",
        waypoints=None,
        departure_time=None,
        arrival_time=None,
        alternatives=True,
        language="en",
        units="metric",
    )
    assert out2 == {"foo": "bar"}


def test_get_directions_exception_propagates():
    handler = NavigationHandler()
    handler.client.directions = MagicMock(side_effect=RuntimeError("fail"))
    with pytest.raises(RuntimeError):
        handler.get_directions("A", "B")


def test_geocode_address_ok_and_zero_and_error():
    handler = NavigationHandler()

    # OK
    handler.client.geocode = MagicMock(return_value=[{"x": 1}])
    res_ok = handler.geocode_address("addr")
    assert res_ok["status"] == "OK"
    assert res_ok["results"] == [{"x": 1}]

    # ZERO_RESULTS
    handler.client.geocode = MagicMock(return_value=[])
    res_zero = handler.geocode_address("addr")
    assert res_zero["status"] == "ZERO_RESULTS"
    assert res_zero["results"] == []

    # exception
    handler.client.geocode = MagicMock(side_effect=ValueError("boom"))
    res_err = handler.geocode_address("addr")
    assert res_err["status"] == "error"
    assert "boom" in res_err["error"]


def test_text_search_places_and_find_places_without_location(monkeypatch):
    handler = NavigationHandler()
    # simulate text search
    stub = {"status": "OK", "places": ["X"]}
    monkeypatch.setattr(handler, "_text_search_places", lambda q, language="en": stub)
    out = handler.find_places("coffee")
    assert out is stub


def test_find_places_with_location_coordinates(monkeypatch):
    handler = NavigationHandler()
    # coords
    monkeypatch.setattr(handler, "_is_coordinates", lambda loc: True)
    places_raw = {"results": [], "status": "OK"}
    handler.client.places_nearby = MagicMock(return_value=places_raw)
    monkeypatch.setattr(handler, "_process_places_response", lambda x: {"processed": True})

    out = handler.find_places("x", "12.3,45.6", radius=100)
    handler.client.places_nearby.assert_called_once_with(
        location="12.3,45.6", keyword="x", radius=100, type=None, language="en"
    )
    assert out == {"processed": True}


def test_find_places_with_location_address_and_geocode_success(monkeypatch):
    handler = NavigationHandler()
    # not coords
    monkeypatch.setattr(handler, "_is_coordinates", lambda loc: False)
    # geocode returns OK
    gres = {"status": "OK", "results": [{"geometry": {"location": {"lat": 1, "lng": 2}}}]}
    monkeypatch.setattr(handler, "geocode_address", lambda addr: gres)
    places_raw = {"results": [], "status": "OK"}
    handler.client.places_nearby = MagicMock(return_value=places_raw)
    monkeypatch.setattr(handler, "_process_places_response", lambda x: {"p": 1})

    out = handler.find_places("y", "somewhere", radius=50, type="park")
    handler.client.places_nearby.assert_called_once_with(
        location={"lat": 1, "lng": 2}, keyword="y", radius=50, type="park", language="en"
    )
    assert out == {"p": 1}


def test_find_places_with_location_address_geocode_zero_results(monkeypatch):
    handler = NavigationHandler()
    monkeypatch.setattr(handler, "_is_coordinates", lambda loc: False)
    monkeypatch.setattr(handler, "geocode_address", lambda addr: {"status": "ZERO_RESULTS"})
    # should fall back to text search
    called = []

    def stub_text(q, language="en"):
        called.append((q, language))
        return {"from_text": True}

    monkeypatch.setattr(handler, "_text_search_places", stub_text)
    out = handler.find_places("z", "nowhere")
    assert out == {"from_text": True}
    assert called == [("z", "en")]


def test_find_places_exception(monkeypatch):
    handler = NavigationHandler()
    monkeypatch.setattr(handler, "_is_coordinates", lambda loc: True)
    handler.client.places_nearby = MagicMock(side_effect=RuntimeError("oops"))
    res = handler.find_places("q", "1,2")
    assert res["status"] == "error"
    assert "oops" in res["error"]
    assert res["places"] == []


@pytest.mark.parametrize(
    "with_val, without_val, expected_level",
    [
        (1000, 1200, "light"),  # ratio ~0.83
        (1200, 1000, "moderate"),  # 1.2
        (1400, 1000, "heavy"),  # 1.4
        (2000, 1000, "severe"),  # 2.0
    ],
)
def test_get_traffic_info_levels(monkeypatch, with_val, without_val, expected_level):
    handler = NavigationHandler()

    # freeze time
    monkeypatch.setattr(time, "time", lambda: 1000000)
    calls = []

    def fake_directions(origin, destination, mode, departure_time, **kwargs):
        calls.append(departure_time)
        # first call is with_traffic, second is without_traffic
        if departure_time == 1000000:
            return [{"legs": [{"duration_in_traffic": {"value": with_val, "text": f"{with_val}s"}}]}]
        else:
            return [{"legs": [{"duration": {"value": without_val, "text": f"{without_val}s"}}]}]

    handler.client.directions = fake_directions

    out = handler.get_traffic_info("A", "B")
    # ensure it used now and now-86400
    assert calls == [1000000, 1000000 - 86400]
    assert out["status"] == "success"
    assert out["traffic_level"] == expected_level
    # delay in minutes floor
    assert isinstance(out["delay_minutes"], int)
    assert out["has_traffic"] == (with_val > without_val * 1.1)


def test_get_traffic_info_missing_data(monkeypatch):
    handler = NavigationHandler()
    handler.client.directions = lambda *args, **kwargs: []
    out = handler.get_traffic_info("o", "d", departure_time=123)
    assert out["status"] == "error"
    assert out["traffic_level"] == "unknown"
    assert out["has_traffic"] is False


def test_get_traffic_info_exception(monkeypatch):
    handler = NavigationHandler()
    handler.client.directions = MagicMock(side_effect=RuntimeError("fail"))
    out = handler.get_traffic_info("o", "d", departure_time=123)
    assert out["status"] == "error"
    assert "fail" in out["error"]
    assert out["has_traffic"] is False
