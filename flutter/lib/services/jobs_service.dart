import '../models/jobs_models.dart';
import 'supabase_client.dart';

class JobsService {
  const JobsService();

  Future<List<JobPosting>> fetchJobs({
    String? category,
    String? workplace,
    String? query,
    int limit = 60,
  }) async {
    dynamic q = supabase
        .from('job_postings')
        .select('*')
        .eq('status', 'open')
        .order('featured', ascending: false)
        .order('created_at', ascending: false);
    if (category != null && category.isNotEmpty) q = q.eq('category', category);
    if (workplace != null && workplace.isNotEmpty) {
      q = q.eq('workplace_type', workplace);
    }
    if (query != null && query.isNotEmpty) q = q.ilike('title', '%$query%');
    final data = await q.limit(limit);
    return (data as List)
        .map((e) => JobPosting.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<List<JobCompany>> fetchCompanies({int limit = 30}) async {
    final data = await supabase
        .from('job_companies')
        .select('*')
        .eq('active', true)
        .order('verified', ascending: false)
        .order('created_at', ascending: false)
        .limit(limit);
    return (data as List)
        .map((e) => JobCompany.fromMap(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<Set<String>> fetchSavedIds(String userId) async {
    final data = await supabase
        .from('job_saves')
        .select('job_id')
        .eq('user_id', userId);
    return (data as List).map((e) => e['job_id'].toString()).toSet();
  }

  Future<void> toggleSave(String userId, String jobId, bool saved) async {
    if (saved) {
      await supabase
          .from('job_saves')
          .delete()
          .eq('user_id', userId)
          .eq('job_id', jobId);
    } else {
      await supabase
          .from('job_saves')
          .insert({'user_id': userId, 'job_id': jobId});
    }
  }

  Future<void> applyToJob({
    required String jobId,
    required String applicantId,
    String? name,
    String? email,
    String? phone,
    String? coverLetter,
    String? cvLink,
  }) async {
    await supabase.from('job_applications').insert({
      'job_id': jobId,
      'applicant_id': applicantId,
      'applicant_name': name,
      'applicant_email': email,
      'applicant_phone': phone,
      'cover_letter': coverLetter,
      'cv_link': cvLink,
      'status': 'submitted',
    });
  }
}

const jobsService = JobsService();
