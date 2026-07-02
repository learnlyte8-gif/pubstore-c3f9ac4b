import '../models/jobs_models.dart';
import 'supabase_client.dart';

class LogisticsService {
  const LogisticsService();

  Future<List<LogisticsRequest>> fetchOpen({int limit = 30}) async {
    final data = await supabase
        .from('logistics_requests')
        .select('*')
        .eq('status', 'open')
        .order('created_at', ascending: false)
        .limit(limit);
    return (data as List)
        .map((e) => LogisticsRequest.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<LogisticsRequest>> fetchMine(String userId) async {
    final data = await supabase
        .from('logistics_requests')
        .select('*')
        .eq('buyer_id', userId)
        .order('created_at', ascending: false);
    return (data as List)
        .map((e) => LogisticsRequest.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> createRequest({
    required String buyerId,
    required String title,
    required String vehicleType,
    required String pickupCity,
    required String dropoffCity,
    String? description,
    double? weightKg,
    double? budget,
    String currency = 'USD',
  }) async {
    await supabase.from('logistics_requests').insert({
      'buyer_id': buyerId,
      'title': title,
      'vehicle_type': vehicleType,
      'pickup_city': pickupCity,
      'dropoff_city': dropoffCity,
      'description': description,
      'weight_kg': weightKg,
      'budget': budget,
      'currency': currency,
      'status': 'open',
    });
  }

  Future<void> placeBid({
    required String requestId,
    required String driverId,
    required double amount,
    String? note,
    String currency = 'USD',
  }) async {
    await supabase.from('logistics_bids').insert({
      'request_id': requestId,
      'driver_id': driverId,
      'amount': amount,
      'note': note,
      'currency': currency,
      'status': 'pending',
    });
  }
}

const logisticsService = LogisticsService();
