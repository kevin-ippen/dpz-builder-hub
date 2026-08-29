import {
    Box,
    FlaskConical,
    Lightbulb,
    Briefcase,
    BarChart3,
    Target,
    type LucideIcon,
  } from 'lucide-react';
  
  export type FeatureMaturity = 'ga' | 'beta' | 'alpha';
  export type FeatureGroup = 'Discover' | 'Create' | 'Observe';
  
  export interface FeatureConfig {
    id: string;
    name: string;
    path: string;
    description: string;
    icon: LucideIcon;
    group: FeatureGroup;
    maturity: FeatureMaturity;
    showInLanding?: boolean;
    /** When set, permission checks use this feature ID instead of `id`. */
    permissionId?: string;
  }
  
  export const features: FeatureConfig[] = [
    // ─── Discover ─── Find things to reuse, understand the landscape
    {
      id: 'assets',
      name: 'Explore',
      path: '/assets',
      description: 'Browse certified and production-ready assets — filter by type, maturity, and domain.',
      icon: Box,
      group: 'Discover',
      maturity: 'ga',
      showInLanding: true,
    },
    {
      id: 'lab',
      name: 'Lab',
      path: '/lab',
      description: 'Experimental builds, vibe projects, and community contributions — pre-production work.',
      icon: FlaskConical,
      group: 'Discover',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'assets',
    },

    // ─── Create ─── Contribute ideas, manage your portfolio
    {
      id: 'data-products',
      name: 'Submit',
      path: '/submit',
      description: 'Register an idea, POC, or production asset — starts at maturity=idea.',
      icon: Lightbulb,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
    },
    {
      id: 'my-products',
      name: 'My Portfolio',
      path: '/my-portfolio',
      description: 'Your assets across all maturity stages — ideas through production.',
      icon: Briefcase,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'data-products',
    },
    {
      id: 'my-requests',
      name: 'Demands',
      path: '/demands',
      description: 'Evidence of need — "I need X" signals that get matched to existing assets.',
      icon: Target,
      group: 'Create',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'data-products',
    },


    // ─── Observe ─── Single dashboard: portfolio landscape, adoption, health
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/dashboard',
      description: 'Portfolio health, adoption signals, and cost/quality at a glance.',
      icon: BarChart3,
      group: 'Observe',
      maturity: 'ga',
      showInLanding: true,
      permissionId: 'assets',
    },
  ];
  
  // Helper function to get feature by path
  export const getFeatureByPath = (path: string): FeatureConfig | undefined =>
    features.find((feature) => feature.path === path);
  
  // Helper function to get feature name by path (for breadcrumbs)
  export const getFeatureNameByPath = (pathSegment: string): string => {
      const feature = features.find(f => f.path === `/${pathSegment}` || f.path === pathSegment);
      return feature?.name || pathSegment;
  };
  
  // Helper function to group features for navigation
  export const getNavigationGroups = (
      allowedMaturities: FeatureMaturity[] = ['ga']
    ): { name: FeatureGroup; items: FeatureConfig[] }[] => {
      const grouped: { [key in FeatureGroup]?: FeatureConfig[] } = {};
  
      features
        .filter((feature) => allowedMaturities.includes(feature.maturity))
        .forEach((feature) => {
          if (!grouped[feature.group]) {
            grouped[feature.group] = [];
          }
          grouped[feature.group]?.push(feature);
        });
  
      const groupOrder: FeatureGroup[] = ['Discover', 'Create', 'Observe'];
  
      return groupOrder
          .map(groupName => ({
              name: groupName,
              items: grouped[groupName] || []
          }))
          .filter(group => group.items.length > 0);
    };
  
  // Helper function to get features for landing pages (Home, About)
  export const getLandingPageFeatures = (
      allowedMaturities: FeatureMaturity[] = ['ga']
  ): FeatureConfig[] => {
      return features.filter(
          (feature) =>
          feature.showInLanding && allowedMaturities.includes(feature.maturity)
      );
  };
