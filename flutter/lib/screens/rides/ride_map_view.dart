import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import 'ride_data.dart';

/// Google Maps wrapper mirroring the web `RideMap` component.
class RideMapView extends StatefulWidget {
  const RideMapView({
    super.key,
    this.me,
    this.pickup,
    this.dropoff,
    this.driverPosition,
    this.drivers = const [],
    this.sharedTrips = const [],
    this.demand = const [],
    this.routes = const [],
    this.selectedRouteId,
    this.onTap,
  });

  final LatLng? me;
  final LatLng? pickup;
  final LatLng? dropoff;
  final LatLng? driverPosition;
  final List<DriverPin> drivers;
  final List<SharedTripPin> sharedTrips;
  final List<LatLng> demand;
  final List<RouteAlt> routes;
  final String? selectedRouteId;
  final void Function(LatLng pos)? onTap;

  @override
  State<RideMapView> createState() => _RideMapViewState();
}

class DriverPin {
  const DriverPin({required this.id, required this.lat, required this.lng, required this.vehicleClass, this.name});
  final String id;
  final double lat;
  final double lng;
  final String vehicleClass;
  final String? name;
}

class SharedTripPin {
  const SharedTripPin({required this.id, required this.lat, required this.lng, required this.destAddress, required this.seatsAvailable});
  final String id;
  final double lat;
  final double lng;
  final String destAddress;
  final int seatsAvailable;
}

class _RideMapViewState extends State<RideMapView> {
  GoogleMapController? _c;
  LatLng? _lastFit;

  static const LatLng _fallback = LatLng(-17.8252, 31.0335); // Harare

  @override
  void didUpdateWidget(covariant RideMapView old) {
    super.didUpdateWidget(old);
    _maybeFit();
  }

  void _maybeFit() {
    if (_c == null) return;
    final p = widget.pickup;
    final d = widget.dropoff;
    if (p != null && d != null) {
      final key = LatLng((p.latitude + d.latitude) / 2, (p.longitude + d.longitude) / 2);
      if (_lastFit != null && _lastFit!.latitude == key.latitude && _lastFit!.longitude == key.longitude) return;
      _lastFit = key;
      final sw = LatLng(
        p.latitude < d.latitude ? p.latitude : d.latitude,
        p.longitude < d.longitude ? p.longitude : d.longitude,
      );
      final ne = LatLng(
        p.latitude > d.latitude ? p.latitude : d.latitude,
        p.longitude > d.longitude ? p.longitude : d.longitude,
      );
      _c!.animateCamera(CameraUpdate.newLatLngBounds(LatLngBounds(southwest: sw, northeast: ne), 60));
    } else if (widget.me != null) {
      if (_lastFit != null && _lastFit!.latitude == widget.me!.latitude && _lastFit!.longitude == widget.me!.longitude) return;
      _lastFit = widget.me;
      _c!.animateCamera(CameraUpdate.newLatLngZoom(widget.me!, 14));
    }
  }

  @override
  Widget build(BuildContext context) {
    final markers = <Marker>{};
    if (widget.pickup != null) {
      markers.add(Marker(
        markerId: const MarkerId('pickup'),
        position: widget.pickup!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: const InfoWindow(title: 'Pickup'),
      ));
    }
    if (widget.dropoff != null) {
      markers.add(Marker(
        markerId: const MarkerId('dropoff'),
        position: widget.dropoff!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueOrange),
        infoWindow: const InfoWindow(title: 'Drop-off'),
      ));
    }
    if (widget.driverPosition != null) {
      markers.add(Marker(
        markerId: const MarkerId('driver'),
        position: widget.driverPosition!,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        infoWindow: const InfoWindow(title: 'Your driver'),
      ));
    }
    for (final d in widget.drivers) {
      markers.add(Marker(
        markerId: MarkerId('drv_${d.id}'),
        position: LatLng(d.lat, d.lng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueYellow),
        infoWindow: InfoWindow(title: d.name ?? 'Driver', snippet: d.vehicleClass),
      ));
    }
    for (final s in widget.sharedTrips) {
      markers.add(Marker(
        markerId: MarkerId('pool_${s.id}'),
        position: LatLng(s.lat, s.lng),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueViolet),
        infoWindow: InfoWindow(title: 'Pool → ${s.destAddress}', snippet: '${s.seatsAvailable} seats'),
      ));
    }
    for (var i = 0; i < widget.demand.length; i++) {
      final p = widget.demand[i];
      markers.add(Marker(
        markerId: MarkerId('dem_$i'),
        position: p,
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRose),
        alpha: 0.55,
      ));
    }

    final polylines = <Polyline>{};
    for (final r in widget.routes) {
      final selected = r.id == (widget.selectedRouteId ?? widget.routes.first.id);
      polylines.add(Polyline(
        polylineId: PolylineId(r.id),
        points: [for (final c in r.coords) LatLng(c[0], c[1])],
        color: switch (r.id) {
          'fastest' => Colors.blue,
          'balanced' => Colors.green,
          'scenic' => Colors.orange,
          _ => Colors.blueGrey,
        },
        width: selected ? 6 : 3,
      ));
    }

    final initial = widget.pickup ?? widget.me ?? _fallback;
    return GoogleMap(
      initialCameraPosition: CameraPosition(target: initial, zoom: 13),
      onMapCreated: (c) {
        _c = c;
        _maybeFit();
      },
      onTap: widget.onTap,
      markers: markers,
      polylines: polylines,
      myLocationEnabled: widget.me != null,
      myLocationButtonEnabled: false,
      zoomControlsEnabled: false,
      compassEnabled: false,
      mapToolbarEnabled: false,
    );
  }
}
