import type { Schema, Struct } from '@strapi/strapi';

export interface BlogCta extends Struct.ComponentSchema {
  collectionName: 'components_blog_ctas';
  info: {
    displayName: 'CTA';
    icon: 'link';
  };
  attributes: {
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String;
    link: Schema.Attribute.String;
  };
}

export interface NavigationNavItem extends Struct.ComponentSchema {
  collectionName: 'components_navigation_nav_items';
  info: {
    description: 'Navigation link item';
    displayName: 'Nav Item';
    icon: 'link';
  };
  attributes: {
    isButton: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    isExternal: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    url: Schema.Attribute.String;
  };
}

export interface PageSectionContactForm extends Struct.ComponentSchema {
  collectionName: 'components_page_section_contact_forms';
  info: {
    displayName: 'Contact Form';
    icon: 'mail';
  };
  attributes: {};
}

export interface PageSectionDifferenceGrid extends Struct.ComponentSchema {
  collectionName: 'components_page_section_difference_grids';
  info: {
    displayName: 'Difference Grid';
    icon: 'shield';
  };
  attributes: {
    boxes: Schema.Attribute.Component<'shared.difference-box', true>;
  };
}

export interface PageSectionFaq extends Struct.ComponentSchema {
  collectionName: 'components_page_section_faqs';
  info: {
    displayName: 'FAQ';
    icon: 'question';
  };
  attributes: {};
}

export interface PageSectionGoldProcess extends Struct.ComponentSchema {
  collectionName: 'components_page_section_gold_processes';
  info: {
    displayName: 'Gold Process';
    icon: 'cog';
  };
  attributes: {
    sectionImage: Schema.Attribute.Media<'images'>;
    steps: Schema.Attribute.Component<'shared.process-step', true>;
  };
}

export interface PageSectionHeroBanner extends Struct.ComponentSchema {
  collectionName: 'components_page_section_hero_banners';
  info: {
    displayName: 'Hero Banner';
    icon: 'images';
  };
  attributes: {
    layout: Schema.Attribute.Enumeration<['full', 'half']> &
      Schema.Attribute.DefaultTo<'full'>;
    slides: Schema.Attribute.Component<'page-section.hero-slide', true>;
  };
}

export interface PageSectionHeroSlide extends Struct.ComponentSchema {
  collectionName: 'components_page_section_hero_slides';
  info: {
    displayName: 'Hero Slide';
    icon: 'image';
  };
  attributes: {
    button1: Schema.Attribute.Component<'blog.cta', false>;
    button2: Schema.Attribute.Component<'blog.cta', false>;
    heroText: Schema.Attribute.Text;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    slideLink: Schema.Attribute.String;
  };
}

export interface PageSectionPromoSlider extends Struct.ComponentSchema {
  collectionName: 'components_page_section_promo_sliders';
  info: {
    displayName: 'Promo Slider';
    icon: 'slideshow';
  };
  attributes: {
    slides: Schema.Attribute.Component<'shared.promo-slide', true>;
  };
}

export interface PageSectionTestimonials extends Struct.ComponentSchema {
  collectionName: 'components_page_section_testimonials';
  info: {
    displayName: 'Testimonials';
    icon: 'user';
  };
  attributes: {};
}

export interface SectionsFaqSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_faq_sections';
  info: {
    description: 'Frequently asked questions section';
    displayName: 'FAQ Section';
    icon: 'question';
  };
  attributes: {
    faqs: Schema.Attribute.Relation<'oneToMany', 'api::faq.faq'>;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SectionsFeedbackSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_feedback_sections';
  info: {
    description: 'Customer testimonials feedback section';
    displayName: 'Feedback Section';
    icon: 'star';
  };
  attributes: {
    subtitle: Schema.Attribute.Text;
    testimonials: Schema.Attribute.Relation<
      'oneToMany',
      'api::testimonial.testimonial'
    >;
    title: Schema.Attribute.String;
  };
}

export interface SectionsGoldSellProcessSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_gold_sell_process_sections';
  info: {
    description: 'Gold selling process steps section';
    displayName: 'Gold Sell Process Section';
    icon: 'list';
  };
  attributes: {
    process_steps: Schema.Attribute.Relation<
      'oneToMany',
      'api::process-step.process-step'
    >;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SectionsGpDifferenceSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_gp_difference_sections';
  info: {
    description: 'The Gold Point Difference section';
    displayName: 'The Gold Point Difference Section';
    icon: 'shield';
  };
  attributes: {
    difference_boxes: Schema.Attribute.Relation<
      'oneToMany',
      'api::difference-box.difference-box'
    >;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SectionsHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_hero_sections';
  info: {
    description: 'Hero section banner with full or half width layout';
    displayName: 'Hero Section';
    icon: 'landscape';
  };
  attributes: {
    button1: Schema.Attribute.Component<'blog.cta', false>;
    button2: Schema.Attribute.Component<'blog.cta', false>;
    heroImage: Schema.Attribute.Media<'images'>;
    heroSubtext: Schema.Attribute.Text;
    heroText: Schema.Attribute.String;
    layout: Schema.Attribute.Enumeration<['full', 'half']> &
      Schema.Attribute.DefaultTo<'full'>;
  };
}

export interface SectionsOtpEnquirySection extends Struct.ComponentSchema {
  collectionName: 'components_sections_otp_enquiry_sections';
  info: {
    description: 'OTP Enquiry form section';
    displayName: 'OTP Enquiry Form Section';
    icon: 'mail';
  };
  attributes: {
    enquiryType: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Enquire Now'>;
    sourceForm: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Dynamic Page Enquiry Form'>;
  };
}

export interface SectionsPromoSliderSection extends Struct.ComponentSchema {
  collectionName: 'components_sections_promo_slider_sections';
  info: {
    description: 'Promo slider section';
    displayName: 'Promo Slider Section';
    icon: 'slideshow';
  };
  attributes: {
    promo_slides: Schema.Attribute.Relation<
      'oneToMany',
      'api::promo-slide.promo-slide'
    >;
  };
}

export interface SectionsRichText extends Struct.ComponentSchema {
  collectionName: 'components_sections_rich_texts';
  info: {
    description: 'A section for rendering markdown/rich text';
    displayName: 'Rich Text Section';
  };
  attributes: {
    content: Schema.Attribute.RichText;
  };
}

export interface SharedBenefitCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_benefit_cards';
  info: {
    description: '';
    displayName: 'Benefit Card';
  };
  attributes: {
    desc: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedCheckItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_check_items';
  info: {
    description: '';
    displayName: 'Check Item';
  };
  attributes: {
    text: Schema.Attribute.String;
  };
}

export interface SharedDifferenceBox extends Struct.ComponentSchema {
  collectionName: 'components_shared_difference_boxes';
  info: {
    displayName: 'Difference Box';
    icon: 'apps';
  };
  attributes: {
    boxDescription: Schema.Attribute.Text;
    boxImage: Schema.Attribute.Media<'images'>;
    boxTitle: Schema.Attribute.String;
    iconType: Schema.Attribute.Enumeration<
      ['flask', 'scale', 'rupee', 'default']
    > &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SharedMilestone extends Struct.ComponentSchema {
  collectionName: 'components_shared_milestones';
  info: {
    description: '';
    displayName: 'Milestone';
  };
  attributes: {
    desc: Schema.Attribute.Text;
    title: Schema.Attribute.String;
    year: Schema.Attribute.String;
  };
}

export interface SharedPillarItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_pillar_items';
  info: {
    description: '';
    displayName: 'Pillar Item';
  };
  attributes: {
    desc: Schema.Attribute.Text;
    iconSvg: Schema.Attribute.Text;
    letter: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedProcessStep extends Struct.ComponentSchema {
  collectionName: 'components_shared_process_steps';
  info: {
    description: '';
    displayName: 'Process Step';
  };
  attributes: {
    desc: Schema.Attribute.Text;
    iconSvg: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedPromoSlide extends Struct.ComponentSchema {
  collectionName: 'components_shared_promo_slides';
  info: {
    displayName: 'Promo Slide';
    icon: 'image';
  };
  attributes: {
    button: Schema.Attribute.Component<'blog.cta', false>;
    creativeImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedServiceItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_service_items';
  info: {
    description: '';
    displayName: 'Service Item';
  };
  attributes: {
    icon: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedStatItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_stat_items';
  info: {
    description: '';
    displayName: 'Stat Item';
  };
  attributes: {
    label: Schema.Attribute.String;
    number: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'blog.cta': BlogCta;
      'navigation.nav-item': NavigationNavItem;
      'page-section.contact-form': PageSectionContactForm;
      'page-section.difference-grid': PageSectionDifferenceGrid;
      'page-section.faq': PageSectionFaq;
      'page-section.gold-process': PageSectionGoldProcess;
      'page-section.hero-banner': PageSectionHeroBanner;
      'page-section.hero-slide': PageSectionHeroSlide;
      'page-section.promo-slider': PageSectionPromoSlider;
      'page-section.testimonials': PageSectionTestimonials;
      'sections.faq-section': SectionsFaqSection;
      'sections.feedback-section': SectionsFeedbackSection;
      'sections.gold-sell-process-section': SectionsGoldSellProcessSection;
      'sections.gp-difference-section': SectionsGpDifferenceSection;
      'sections.hero-section': SectionsHeroSection;
      'sections.otp-enquiry-section': SectionsOtpEnquirySection;
      'sections.promo-slider-section': SectionsPromoSliderSection;
      'sections.rich-text': SectionsRichText;
      'shared.benefit-card': SharedBenefitCard;
      'shared.check-item': SharedCheckItem;
      'shared.difference-box': SharedDifferenceBox;
      'shared.milestone': SharedMilestone;
      'shared.pillar-item': SharedPillarItem;
      'shared.process-step': SharedProcessStep;
      'shared.promo-slide': SharedPromoSlide;
      'shared.service-item': SharedServiceItem;
      'shared.stat-item': SharedStatItem;
    }
  }
}
