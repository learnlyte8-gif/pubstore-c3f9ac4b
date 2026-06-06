// One-file registry for every marketplace vertical. Each export is a real
// native screen that hits its Supabase table directly via VerticalScreen.

import React from 'react';
import { VerticalScreen } from './VerticalScreen';

export const RestaurantsScreen = () => (
  <VerticalScreen
    title="Restaurants"
    table="restaurants"
    select="id,name,cuisine,image,city,rating"
    orderColumn="rating"
    searchColumns={['name', 'cuisine', 'city']}
    mapRow={(r) => ({
      title: r.name,
      subtitle: [r.cuisine, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.rating ? `★ ${Number(r.rating).toFixed(1)}` : null,
    })}
  />
);

export const StaysScreen = () => (
  <VerticalScreen
    title="Stays"
    table="stays"
    select="id,title,city,image,price_per_night,bedrooms,property_type"
    searchColumns={['title', 'city', 'property_type']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.property_type, r.city, r.bedrooms ? `${r.bedrooms} bd` : null].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price_per_night ? `$${Number(r.price_per_night).toFixed(0)}/night` : null,
    })}
  />
);

export const PropertiesScreen = () => (
  <VerticalScreen
    title="Properties"
    table="properties"
    select="id,title,city,image,price,listing_type,bedrooms,bathrooms"
    searchColumns={['title', 'city', 'listing_type']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.listing_type, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price ? `$${Number(r.price).toLocaleString()}` : null,
      badge: r.bedrooms ? `${r.bedrooms} BR` : null,
    })}
  />
);

export const AutoScreen = () => (
  <VerticalScreen
    title="Auto"
    table="vehicles"
    select="id,title,make,model,year,price,image,mileage"
    searchColumns={['title', 'make', 'model']}
    mapRow={(r) => ({
      title: r.title ?? `${r.make ?? ''} ${r.model ?? ''}`.trim(),
      subtitle: [r.year, r.mileage ? `${r.mileage.toLocaleString()} km` : null].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price ? `$${Number(r.price).toLocaleString()}` : null,
    })}
  />
);

export const CarRentalsScreen = () => (
  <VerticalScreen
    title="Car Rentals"
    table="car_rentals"
    select="id,title,city,image,price_per_day,vehicle_type"
    searchColumns={['title', 'city', 'vehicle_type']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.vehicle_type, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price_per_day ? `$${Number(r.price_per_day).toFixed(0)}/day` : null,
    })}
  />
);

export const JobsScreen = () => (
  <VerticalScreen
    title="Jobs"
    table="job_postings"
    select="id,title,location,employment_type,salary_min,salary_max,applicants_count,image"
    searchColumns={['title', 'location', 'employment_type']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.employment_type, r.location].filter(Boolean).join(' · '),
      image: r.image,
      meta:
        r.salary_min || r.salary_max
          ? `$${r.salary_min ?? '?'} – $${r.salary_max ?? '?'}`
          : r.applicants_count
          ? `${r.applicants_count} applicants`
          : null,
    })}
  />
);

export const ServicesScreen = () => (
  <VerticalScreen
    title="Services"
    table="service_providers"
    select="id,name,category,image,city,rating"
    orderColumn="rating"
    searchColumns={['name', 'category', 'city']}
    mapRow={(r) => ({
      title: r.name,
      subtitle: [r.category, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.rating ? `★ ${Number(r.rating).toFixed(1)}` : null,
    })}
  />
);

export const AgroScreen = () => (
  <VerticalScreen
    title="Agro"
    table="agro_listings"
    select="id,title,category,image,price,unit,city"
    searchColumns={['title', 'category', 'city']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.category, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price ? `$${Number(r.price).toFixed(2)}${r.unit ? `/${r.unit}` : ''}` : null,
    })}
  />
);

export const IndustrialScreen = () => (
  <VerticalScreen
    title="Industrial"
    table="industrial_listings"
    select="id,title,category,image,price,moq,city"
    searchColumns={['title', 'category', 'city']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: [r.category, r.city].filter(Boolean).join(' · '),
      image: r.image,
      meta: r.price ? `$${Number(r.price).toFixed(2)}` : r.moq ? `MOQ ${r.moq}` : null,
    })}
  />
);

export const FinanceScreen = () => (
  <VerticalScreen
    title="Finance"
    table="finance_products"
    select="id,title,kind,image,min_amount,max_amount,apr"
    searchColumns={['title', 'kind']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: r.kind,
      image: r.image,
      meta:
        r.apr != null
          ? `${Number(r.apr).toFixed(1)}% APR`
          : r.max_amount
          ? `up to $${Number(r.max_amount).toLocaleString()}`
          : null,
    })}
  />
);

export const NewsScreen = () => (
  <VerticalScreen
    title="News"
    table="news_articles"
    select="id,title,summary,image,source,published_at"
    orderColumn="published_at"
    searchColumns={['title', 'summary', 'source']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: r.summary,
      image: r.image,
      meta: r.source ?? null,
    })}
  />
);

export const LiveScreen = () => (
  <VerticalScreen
    title="Live"
    table="live_streams"
    select="id,title,status,viewer_count,thumbnail"
    searchColumns={['title']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: r.status,
      image: r.thumbnail,
      badge: r.status === 'live' ? 'LIVE' : null,
      meta: r.viewer_count ? `${r.viewer_count} watching` : null,
    })}
  />
);

export const LogisticsScreen = () => (
  <VerticalScreen
    title="Logistics"
    table="logistics_requests"
    select="id,title,pickup_address,dropoff_address,status,budget,created_at"
    searchColumns={['title', 'pickup_address', 'dropoff_address']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: `${r.pickup_address ?? '?'} → ${r.dropoff_address ?? '?'}`,
      badge: r.status,
      meta: r.budget ? `$${Number(r.budget).toFixed(2)}` : null,
    })}
  />
);

export const DriverScreen = () => (
  <VerticalScreen
    title="Driver"
    table="logistics_requests"
    select="id,title,pickup_address,dropoff_address,status,budget"
    searchColumns={['title']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: `${r.pickup_address ?? '?'} → ${r.dropoff_address ?? '?'}`,
      badge: r.status,
      meta: r.budget ? `bid $${Number(r.budget).toFixed(2)}` : null,
    })}
  />
);

export const RFQScreen = () => (
  <VerticalScreen
    title="RFQs"
    table="rfqs"
    select="id,title,description,qty,status,target_price,created_at"
    searchColumns={['title', 'description']}
    mapRow={(r) => ({
      title: r.title,
      subtitle: r.description,
      badge: r.status,
      meta: r.target_price ? `target $${Number(r.target_price).toFixed(2)}` : r.qty ? `qty ${r.qty}` : null,
    })}
  />
);
