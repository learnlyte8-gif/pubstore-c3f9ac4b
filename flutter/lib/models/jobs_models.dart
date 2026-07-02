/// Mirrors `src/data/jobs.ts` type surface.
library jobs_models;

double? _dn(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int? _in(dynamic v) =>
    v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
List<String> _list(dynamic v) =>
    v is List ? v.map((e) => e.toString()).toList() : const [];

class JobCompany {
  JobCompany({
    required this.id,
    required this.name,
    this.tagline,
    this.logoUrl,
    this.coverUrl,
    this.industry,
    this.city,
    this.country,
    this.verified = false,
    this.followers = 0,
  });
  final String id;
  final String name;
  final String? tagline, logoUrl, coverUrl, industry, city, country;
  final bool verified;
  final int followers;

  factory JobCompany.fromMap(Map<String, dynamic> m) => JobCompany(
        id: m['id'].toString(),
        name: (m['name'] ?? '').toString(),
        tagline: m['tagline']?.toString(),
        logoUrl: m['logo_url']?.toString(),
        coverUrl: m['cover_url']?.toString(),
        industry: m['industry']?.toString(),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        verified: m['verified'] == true,
        followers: _in(m['followers_count']) ?? 0,
      );
}

class JobPosting {
  JobPosting({
    required this.id,
    required this.companyId,
    required this.title,
    this.description,
    required this.category,
    required this.employmentType,
    required this.experienceLevel,
    required this.workplaceType,
    this.city,
    this.country,
    this.salaryMin,
    this.salaryMax,
    this.salaryCurrency = 'USD',
    this.salaryPeriod = 'month',
    this.showSalary = true,
    this.skills = const [],
    this.benefits = const [],
    this.applyMode = 'in_app',
    this.applyUrl,
    this.applyEmail,
    this.status = 'open',
    this.featured = false,
    this.views = 0,
    this.applicants = 0,
    this.createdAt,
  });
  final String id, companyId;
  final String title;
  final String? description;
  final String category, employmentType, experienceLevel, workplaceType;
  final String? city, country;
  final double? salaryMin, salaryMax;
  final String salaryCurrency, salaryPeriod;
  final bool showSalary;
  final List<String> skills, benefits;
  final String applyMode;
  final String? applyUrl, applyEmail;
  final String status;
  final bool featured;
  final int views, applicants;
  final DateTime? createdAt;

  factory JobPosting.fromMap(Map<String, dynamic> m) => JobPosting(
        id: m['id'].toString(),
        companyId: (m['company_id'] ?? '').toString(),
        title: (m['title'] ?? '').toString(),
        description: m['description']?.toString(),
        category: (m['category'] ?? 'general').toString(),
        employmentType: (m['employment_type'] ?? 'full_time').toString(),
        experienceLevel: (m['experience_level'] ?? 'mid').toString(),
        workplaceType: (m['workplace_type'] ?? 'on_site').toString(),
        city: m['city']?.toString(),
        country: m['country']?.toString(),
        salaryMin: _dn(m['salary_min']),
        salaryMax: _dn(m['salary_max']),
        salaryCurrency: (m['salary_currency'] ?? 'USD').toString(),
        salaryPeriod: (m['salary_period'] ?? 'month').toString(),
        showSalary: m['show_salary'] != false,
        skills: _list(m['skills_required']),
        benefits: _list(m['benefits']),
        applyMode: (m['apply_mode'] ?? 'in_app').toString(),
        applyUrl: m['apply_url']?.toString(),
        applyEmail: m['apply_email']?.toString(),
        status: (m['status'] ?? 'open').toString(),
        featured: m['featured'] == true,
        views: _in(m['views']) ?? 0,
        applicants: _in(m['applicants_count']) ?? 0,
        createdAt: DateTime.tryParse(m['created_at']?.toString() ?? ''),
      );

  String? get salaryLabel {
    if (!showSalary || (salaryMin == null && salaryMax == null)) return null;
    final per = salaryPeriod == 'year'
        ? '/yr'
        : (salaryPeriod == 'hour' ? '/hr' : '/mo');
    if (salaryMin != null && salaryMax != null) {
      return '$salaryCurrency ${salaryMin!.round()}–${salaryMax!.round()}$per';
    }
    return '$salaryCurrency ${(salaryMin ?? salaryMax)!.round()}$per';
  }
}

class LogisticsRequest {
  LogisticsRequest({
    required this.id,
    required this.buyerId,
    required this.title,
    this.description,
    required this.vehicleType,
    required this.pickupCity,
    required this.dropoffCity,
    this.weightKg,
    this.budget,
    this.currency = 'USD',
    this.status = 'open',
    this.createdAt,
  });
  final String id, buyerId, title;
  final String? description;
  final String vehicleType, pickupCity, dropoffCity;
  final double? weightKg, budget;
  final String currency, status;
  final DateTime? createdAt;

  factory LogisticsRequest.fromMap(Map<String, dynamic> m) => LogisticsRequest(
        id: m['id'].toString(),
        buyerId: (m['buyer_id'] ?? '').toString(),
        title: (m['title'] ?? '').toString(),
        description: m['description']?.toString(),
        vehicleType: (m['vehicle_type'] ?? 'van').toString(),
        pickupCity: (m['pickup_city'] ?? '').toString(),
        dropoffCity: (m['dropoff_city'] ?? '').toString(),
        weightKg: _dn(m['weight_kg']),
        budget: _dn(m['budget']),
        currency: (m['currency'] ?? 'USD').toString(),
        status: (m['status'] ?? 'open').toString(),
        createdAt: DateTime.tryParse(m['created_at']?.toString() ?? ''),
      );
}
