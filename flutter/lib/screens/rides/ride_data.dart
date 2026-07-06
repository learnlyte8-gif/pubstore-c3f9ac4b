import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

/// Vehicle class metadata mirroring `src/pages/Rides.tsx` CLASSES.
class VehicleClassMeta {
  const VehicleClassMeta({
    required this.id,
    required this.label,
    required this.eta,
    required this.seats,
    required this.mult,
    required this.base,
    required this.perKm,
  });
  final String id;
  final String label;
  final String eta;
  final String seats;
  final double mult;
  final double base;
  final double perKm;
}

const kVehicleClasses = <VehicleClassMeta>[
  VehicleClassMeta(id: 'moto', label: 'Moto', eta: '2 min', seats: '1 seat', mult: 0.55, base: 1.0, perKm: 0.5),
  VehicleClassMeta(id: 'economy', label: 'Economy', eta: '4 min', seats: '4 seats', mult: 1.0, base: 1.5, perKm: 0.8),
  VehicleClassMeta(id: 'comfort', label: 'Comfort', eta: '5 min', seats: '4 seats', mult: 1.35, base: 2.2, perKm: 1.2),
  VehicleClassMeta(id: 'xl', label: 'XL', eta: '6 min', seats: '6 seats', mult: 1.7, base: 3.0, perKm: 1.6),
];

VehicleClassMeta vehicleClassFor(String id) =>
    kVehicleClasses.firstWhere((c) => c.id == id, orElse: () => kVehicleClasses[1]);

double haversineKm(double lat1, double lon1, double lat2, double lon2) {
  const R = 6371.0;
  double d2r(double d) => d * math.pi / 180.0;
  final dLat = d2r(lat2 - lat1);
  final dLon = d2r(lon2 - lon1);
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(d2r(lat1)) * math.cos(d2r(lat2)) * math.sin(dLon / 2) * math.sin(dLon / 2);
  return 2 * R * math.asin(math.sqrt(a));
}

double suggestFare(double km, String vClass) {
  final c = vehicleClassFor(vClass);
  return math.max(2, ((c.base + km * c.perKm) * 100).round() / 100);
}

double computeSurge(int nearbyDrivers) {
  if (nearbyDrivers == 0) return 1.6;
  if (nearbyDrivers < 3) return 1.35;
  if (nearbyDrivers < 6) return 1.1;
  return 1.0;
}

/// Reverse-geocode with Nominatim. Falls back to lat,lng string.
Future<String> reverseGeocode(double lat, double lng) async {
  try {
    final r = await http.get(
      Uri.parse('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$lat&lon=$lng&zoom=16'),
      headers: {'User-Agent': 'PUBSTORE-mobile/1.0'},
    ).timeout(const Duration(seconds: 6));
    if (r.statusCode == 200) {
      final j = jsonDecode(r.body) as Map<String, dynamic>;
      final d = j['display_name'];
      if (d is String && d.isNotEmpty) return d;
    }
  } catch (_) {}
  return '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
}

class PlaceHit {
  const PlaceHit({required this.lat, required this.lng, required this.label});
  final double lat;
  final double lng;
  final String label;
}

Future<List<PlaceHit>> searchPlace(String q) async {
  if (q.trim().isEmpty) return const [];
  try {
    final r = await http.get(
      Uri.parse('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${Uri.encodeQueryComponent(q)}'),
      headers: {'User-Agent': 'PUBSTORE-mobile/1.0'},
    ).timeout(const Duration(seconds: 6));
    if (r.statusCode != 200) return const [];
    final list = jsonDecode(r.body) as List<dynamic>;
    return list
        .whereType<Map<String, dynamic>>()
        .map((it) => PlaceHit(
              lat: double.tryParse('${it['lat']}') ?? 0,
              lng: double.tryParse('${it['lon']}') ?? 0,
              label: (it['display_name'] as String?) ?? '',
            ))
        .where((p) => p.lat != 0 && p.lng != 0)
        .toList();
  } catch (_) {
    return const [];
  }
}

/// 3 quadratic-Bezier alternatives between p and d.
class RouteAlt {
  const RouteAlt({
    required this.id,
    required this.label,
    required this.km,
    required this.mins,
    required this.traffic,
    required this.coords,
  });
  final String id;
  final String label;
  final double km;
  final int mins;
  final String traffic; // free | light | moderate
  final List<List<double>> coords; // [lat, lng]
}

List<RouteAlt> buildRoutes(double pLat, double pLng, double dLat, double dLng) {
  List<List<double>> make(double curve, {int segs = 24}) {
    final dx = dLng - pLng;
    final dy = dLat - pLat;
    final nx = -dy;
    final ny = dx;
    final norm = math.sqrt(nx * nx + ny * ny);
    final n = norm == 0 ? 1.0 : norm;
    final ox = (nx / n) * curve;
    final oy = (ny / n) * curve;
    final cx = (pLng + dLng) / 2 + ox;
    final cy = (pLat + dLat) / 2 + oy;
    final out = <List<double>>[];
    for (var i = 0; i <= segs; i++) {
      final t = i / segs;
      final x = (1 - t) * (1 - t) * pLng + 2 * (1 - t) * t * cx + t * t * dLng;
      final y = (1 - t) * (1 - t) * pLat + 2 * (1 - t) * t * cy + t * t * dLat;
      out.add([y, x]);
    }
    return out;
  }

  final base = haversineKm(pLat, pLng, dLat, dLng);
  return [
    RouteAlt(id: 'fastest', label: 'Fastest', km: base * 1.05, mins: math.max(4, (base * 2.4).round()), traffic: 'moderate', coords: make(base * 0.003)),
    RouteAlt(id: 'balanced', label: 'Balanced', km: base * 1.18, mins: math.max(5, (base * 2.8).round()), traffic: 'light', coords: make(-base * 0.006)),
    RouteAlt(id: 'scenic', label: 'Scenic', km: base * 1.42, mins: math.max(7, (base * 3.6).round()), traffic: 'free', coords: make(base * 0.012)),
  ];
}
