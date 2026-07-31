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

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'blog.cta': BlogCta;
    }
  }
}
