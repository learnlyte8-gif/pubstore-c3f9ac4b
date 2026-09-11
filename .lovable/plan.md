# Expand product ad templates

## What will change
- Add several reusable product-ad templates, including a hero image with five supporting images, a staggered product gallery, and an Alibaba-style wholesale offer.
- Carry each product’s gallery images into generated ads so multi-image templates use real images from that product.
- Extend the ad renderer so every new layout has a purpose-built square or vertical composition while existing templates keep working.
- Show template layout previews in the admin studio so the differences are easy to choose.

## Technical details
- Seed new `ad_templates` records with distinct `style.layout` values.
- Store selected product gallery URLs on each generated ad using the existing ad record structure if possible; otherwise add one scoped gallery column.
- Update the canvas renderer to preload, deduplicate, crop, and arrange up to six product images.
- Verify existing and new layouts compile and render without breaking downloads.
