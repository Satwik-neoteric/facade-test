# Templates Directory - Facade Studio Frontend Views

## Overview

The `templates` directory contains all Jinja2 HTML templates that render the user interface for the Facade Studio application. This directory follows a hierarchical structure with base templates, page-specific templates, reusable components, and specialized admin interfaces. Each template is mapped to specific FastAPI route functions and serves different user roles and functionalities.

## 🏗️ Architecture

### Template Inheritance Hierarchy
```
basic.html (Base template)
├── admin.html (Admin interface)
├── dashboard.html (Analytics dashboard)
├── label.html (Labeling interface)
├── base.html (Home interface)
└── intro.html (Landing page - standalone)
```

### Technology Stack
- **Template Engine**: Jinja2 with FastAPI integration
- **CSS Framework**: Tailwind CSS with custom dark mode support
- **JavaScript**: Vanilla ES6+ with modular components from `updated_ui`
- **Icons**: Font Awesome 6.x
- **Authentication**: FastAPI dependency injection with role-based access

## 📁 Directory Structure

```
templates/
├── admin/                  # Admin-specific templates
│   ├── modals/            # Admin modal dialogs
│   └── sections/          # Admin page sections
├── components/            # Reusable UI components
├── admin.html            # Admin dashboard (main)
├── base.html             # Home page template
├── basic.html            # Base template (extends all)
├── dashboard.html        # Analytics dashboard
├── diagnostic.html       # System diagnostic page
├── index.html            # Legacy index page
├── intro.html            # Landing/welcome page
├── label.html            # Image labeling interface
├── pipelines.html        # Pipeline management
├── simple_label.html     # Simplified labeling
├── simple_original_label.html  # Original simple labeling
├── theme-debug.html      # Theme debugging tools
└── theme-test.html       # Theme testing page
```

## 🌐 Route Function Mappings

### **Public Routes (No Authentication Required)**

#### `/` - Root Entry Point
- **Function**: `read_root_and_redirect()`
- **Template**: `intro.html`
- **Purpose**: Main entry point that redirects authenticated users to `/home` or shows intro page
- **Features**: 
  - Landing page data from `landingPageData.json`
  - Session detection and auto-redirect
  - Dark mode support with theme persistence

#### `/intro` - Direct Intro Access
- **Function**: `intro_page_direct()`
- **Template**: `intro.html`
- **Purpose**: Direct access to the introduction/welcome page
- **Features**: 
  - Company information and services
  - Hero section with call-to-action
  - Modern responsive design

### **Protected Routes (Authentication Required)**

#### `/home` - Home Dashboard
- **Function**: `home_page()`
- **Template**: `base.html`
- **Authentication**: `get_current_web_user` + `has_role(['Administrator', 'Labeller', 'Reviewer'])`
- **Purpose**: Main application dashboard after login
- **Features**: 
  - User role detection
  - Admin privilege checking
  - Responsive navigation

#### `/label` - Labeling Interface
- **Function**: `label_page()`
- **Template**: `label.html`
- **Authentication**: `get_current_web_user` + `has_role(['Administrator', 'Labeller', 'Reviewer'])`
- **Purpose**: Image annotation and labeling workspace
- **Features**: 
  - Split-pane interface (image list + labeling area)
  - Batch management integration
  - Real-time annotation tools

#### `/dashboard` - Analytics Dashboard
- **Function**: `dashboard_page()`
- **Template**: `dashboard.html`
- **Authentication**: `get_current_web_user` + `has_role(['Administrator', 'Labeller', 'Reviewer'])`
- **Purpose**: Statistics and analytics visualization
- **Features**: 
  - Chart.js integration for data visualization
  - Batch filtering and management
  - Performance metrics display

#### `/admin` - Administrator Interface
- **Function**: `admin_page()`
- **Template**: `admin.html`
- **Authentication**: `get_current_web_user` + `has_role(['Administrator'])`
- **Purpose**: System administration and user management
- **Features**: 
  - User management with Azure AD integration
  - System configuration
  - Advanced administrative tools
  - Role-based access control

#### `/pipelines-admin` - Pipeline Management
- **Function**: `pipelines_admin_page()`
- **Template**: `pipelines.html`
- **Authentication**: `get_current_web_user`
- **Purpose**: ML pipeline management and configuration
- **Features**: 
  - Pipeline creation and editing
  - Model management integration
  - Batch processing controls

### **Development & Diagnostic Routes**

#### `/diagnostic-tool` - System Diagnostics
- **Function**: `diagnostic_page()`
- **Template**: `diagnostic.html`
- **Authentication**: None (public for debugging)
- **Purpose**: System health monitoring and debugging
- **Features**: 
  - Service connectivity tests
  - Configuration validation
  - Debug mode indicators

#### `/theme-test` - Theme Testing
- **Function**: `theme_test_page()`
- **Template**: `theme-test.html`
- **Authentication**: None (development only)
- **Purpose**: Theme toggle functionality testing
- **Features**: 
  - Basic theme switching test
  - Visual feedback for theme changes

#### `/theme-debug` - Advanced Theme Debugging
- **Function**: `theme_debug_page()`
- **Template**: `theme-debug.html`
- **Authentication**: None (development only)
- **Purpose**: Comprehensive theme debugging and manual controls
- **Features**: 
  - Real-time theme state monitoring
  - Manual theme controls
  - CSS variable inspection

## 📄 Template Documentation

### **Base Templates**

#### `basic.html` - Application Foundation
**Purpose**: Core template that all other templates extend
**Features**:
- Tailwind CSS configuration with dark mode support
- Font Awesome icon integration
- Theme management JavaScript
- Responsive layout structure
- Dark mode CSS component integration

**Key Sections**:
```html
<!-- Head configuration -->
- Tailwind CSS with custom config
- Dark mode component styles
- Custom animations and utilities

<!-- Body structure -->
- App header inclusion
- Main content block
- Script loading system
```

**Usage Pattern**:
```jinja2
{% extends "basic.html" %}
{% block title %}Page Title{% endblock %}
{% block content %}
<!-- Page content here -->
{% endblock %}
```

#### `intro.html` - Landing Page (Standalone)
**Purpose**: Welcome page for unauthenticated users
**Features**:
- Hero section with gradient backgrounds
- Service and feature showcases
- Team member profiles
- Contact information
- Call-to-action buttons

**Key Components Used**:
- `components/hero_section.html`
- `components/features_section.html`
- `components/services_section.html`
- `components/team_section.html`
- `components/gallery_section.html`
- `components/workflow_section.html`
- `components/contact_section.html`
- `components/footer.html`

### **Application Pages**

#### `admin.html` - Administration Interface
**Function**: `admin_page()`
**Purpose**: Complete administrative control panel
**Key Features**:
- User management with Azure AD integration
- Role assignment and permissions
- System monitoring and configuration
- Batch and image management
- Model and pipeline administration

**Admin Sections** (from `admin/sections/`):
- `user_management.html` - User CRUD operations
- `batch_management.html` - Batch processing controls
- `building_management.html` - Building data management
- `category_management.html` - Classification categories
- `model_management.html` - AI model management
- `pipeline_management.html` - ML pipeline controls

**Admin Modals** (from `admin/modals/`):
- `user_modal.html` - User creation/editing
- `batch_images_modal.html` - Batch image operations
- `category_modal.html` - Category management
- `model_modal.html` - Model configuration
- `pipeline_modal.html` - Pipeline setup
- `building_modal.html` - Building data entry
- `edit_roles_modal.html` - Role management
- `register_batch_modal.html` - Batch registration
- `run_inference_modal.html` - Model inference execution
- `upload_images_modal.html` - Image upload interface

#### `dashboard.html` - Analytics Dashboard
**Function**: `dashboard_page()`
**Purpose**: Data visualization and performance monitoring
**Key Features**:
- Chart.js integration for data visualization
- Real-time statistics display
- Batch filtering and analysis
- Performance metrics tracking
- Interactive data exploration

**Chart Types**:
- Images per batch (bar chart)
- Annotation progress (line chart)
- Model performance metrics
- User activity tracking

#### `label.html` - Labeling Interface
**Function**: `label_page()`
**Purpose**: Image annotation and labeling workspace
**Key Features**:
- Split-pane interface design
- Image browser with batch filtering
- Advanced annotation tools
- Label validation and review
- Keyboard shortcuts support

**Interface Sections**:
- Left sidebar: Image list and batch selection
- Center panel: Image display and annotation tools
- Action toolbar: Save, validate, navigation controls

#### `base.html` - Home Dashboard
**Function**: `home_page()`
**Purpose**: Main application landing after authentication
**Key Features**:
- Welcome message and user information
- Quick access to main functions
- Recent activity display
- Navigation to other application areas

### **Component Templates**

#### Navigation Components
- **`components/navbar.html`** - Main navigation bar
  - Theme toggle functionality
  - User authentication state
  - Responsive mobile menu

- **`components/app_header.html`** - Application header
  - Logo and branding
  - User profile information
  - Administrative controls

#### Landing Page Components
- **`components/hero_section.html`** - Hero banner
  - Gradient backgrounds with dark mode
  - Call-to-action buttons
  - Animated elements

- **`components/features_section.html`** - Feature showcase
  - Grid layout of capabilities
  - Icon-based feature cards
  - Hover effects and animations

- **`components/services_section.html`** - Service offerings
  - Service cards with descriptions
  - Trust badges and guarantees
  - Modern card design

- **`components/team_section.html`** - Team member profiles
  - Professional headshots
  - Role and contact information
  - Social media links

- **`components/gallery_section.html`** - Project gallery
  - Image grid with modal display
  - Lazy loading optimization
  - Responsive design

- **`components/workflow_section.html`** - Process workflow
  - Step-by-step process display
  - Progress indicators
  - Interactive elements

- **`components/contact_section.html`** - Contact information
  - Contact details and social links
  - Modern glassmorphism design
  - Interactive hover effects

- **`components/footer.html`** - Site footer
  - Company information
  - Quick links and legal pages
  - Responsive layout

### **Specialized Pages**

#### `pipelines.html` - Pipeline Management
**Function**: `pipelines_admin_page()`
**Purpose**: ML pipeline configuration and management
**Features**:
- Pipeline creation wizard
- Model integration controls
- Batch processing configuration
- Performance monitoring

#### `diagnostic.html` - System Diagnostics
**Function**: `diagnostic_page()`
**Purpose**: System health and debugging tools
**Features**:
- Service connectivity tests
- Configuration validation
- Error logging and monitoring
- Debug mode controls

## 🎨 Styling and Theming

### Dark Mode Implementation
All templates include comprehensive dark mode support through:
- **CSS Custom Properties**: Dynamic theme variables
- **Tailwind Dark Classes**: `dark:` prefixed utilities
- **Component-Specific Styling**: Custom dark mode overrides
- **Theme Persistence**: localStorage-based theme memory

### Responsive Design
- **Mobile-First Approach**: Progressive enhancement for larger screens
- **Breakpoint System**: Following Tailwind CSS conventions
- **Touch-Friendly UI**: Optimized for mobile interaction
- **Cross-Device Compatibility**: Consistent experience across devices

### Component Integration
Templates seamlessly integrate with the `updated_ui` framework:
- **Module Loading**: FacadeStudioLoader for dynamic component loading
- **Theme Management**: ThemeManager for consistent theming
- **Component Libraries**: Reusable UI components and utilities

## 🔐 Authentication and Security

### Role-Based Access Control
Templates implement security through FastAPI dependencies:
- **`get_current_web_user`**: Validates user authentication
- **`has_role(roles)`**: Enforces role-based permissions
- **Admin-Only Access**: Restricted administrative functions

### User Roles
- **Administrator**: Full system access, user management, configuration
- **Labeller**: Image annotation and labeling capabilities
- **Reviewer**: Review and validation of annotations

### Security Features
- **Session Management**: Secure cookie-based authentication
- **CSRF Protection**: Built-in security measures
- **Input Validation**: Server-side validation for all inputs
- **Access Logging**: Comprehensive audit trails

## 🚀 Performance Optimization

### Loading Strategies
- **Critical CSS Inline**: Essential styles loaded immediately
- **Lazy Loading**: Non-critical components loaded on demand
- **Module Bundling**: Efficient JavaScript loading
- **Image Optimization**: Responsive images with lazy loading

### Caching
- **Static Asset Caching**: Long-term caching for CSS/JS
- **Template Caching**: Jinja2 template compilation caching
- **CDN Integration**: External resources from CDNs

## 📱 Mobile Responsiveness

### Design Patterns
- **Progressive Enhancement**: Desktop features add to mobile base
- **Touch Optimization**: Large touch targets and gestures
- **Viewport Optimization**: Proper meta viewport configuration
- **Performance Focus**: Lightweight mobile experience

### Responsive Components
All components adapt to screen sizes:
- **Navigation**: Collapsible mobile menu
- **Cards**: Responsive grid layouts
- **Forms**: Touch-friendly input controls
- **Charts**: Responsive data visualization

## 🛠️ Development Guidelines

### Template Creation Standards
```jinja2
{# Template header with purpose documentation #}
{% extends "basic.html" %}

{% block title %}Page Name - Facade AI Studio{% endblock %}

{% block head_extra %}
{# Page-specific CSS and meta tags #}
{% endblock %}

{% block content %}
{# Main page content #}
<main class="container mx-auto px-4 py-8">
    <!-- Accessible, semantic HTML structure -->
</main>
{% endblock %}

{% block scripts_extra %}
{# Page-specific JavaScript #}
{% endblock %}
```

### Component Usage
```jinja2
{# Include reusable components #}
{% include 'components/navbar.html' %}

{# Pass data to components when needed #}
{% include 'components/hero_section.html' with data.hero %}
```

### Data Binding
```jinja2
{# Safe data binding with fallbacks #}
{{ data.title | default('Default Title') }}

{# Conditional rendering #}
{% if user.is_admin %}
    {% include 'admin/admin_controls.html' %}
{% endif %}

{# Loop rendering with error handling #}
{% for item in data.items | default([]) %}
    <!-- Item rendering -->
{% endfor %}
```

## 🔧 Debugging and Testing

### Debug Templates
- **`theme-debug.html`**: Real-time theme state monitoring
- **`theme-test.html`**: Basic theme functionality testing
- **`diagnostic.html`**: System health and connectivity

### Debug Features
- **Console Logging**: Comprehensive client-side logging
- **Error Boundaries**: Graceful error handling
- **Performance Monitoring**: Load time and interaction tracking
- **Accessibility Testing**: WCAG 2.1 compliance validation

## 📊 Analytics and Monitoring

### User Experience Tracking
- **Page Load Times**: Performance monitoring
- **User Interactions**: Click and navigation tracking
- **Error Reporting**: Client-side error collection
- **Feature Usage**: Usage analytics for optimization

### System Monitoring
- **Template Rendering**: Server-side performance metrics
- **Resource Loading**: Asset loading performance
- **Error Rates**: Template error tracking
- **User Session**: Authentication and session analytics

## 🔮 Future Enhancements

### Planned Features
1. **Progressive Web App**: Offline capability and app-like experience
2. **Advanced Animations**: Enhanced user interface transitions
3. **Micro-Interactions**: Improved user feedback and engagement
4. **Accessibility Improvements**: Enhanced WCAG compliance
5. **Internationalization**: Multi-language support

### Template Evolution
- **Component Library**: Standardized component documentation
- **Design System**: Comprehensive design guidelines
- **Performance Optimization**: Further loading optimizations
- **SEO Enhancement**: Improved search engine optimization

## 📚 Quick Reference

### Common Template Patterns

#### Page Header Pattern
```jinja2
<div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 mb-8 text-white">
    <h1 class="text-4xl font-bold mb-4">{{ page_title }}</h1>
    <p class="text-xl opacity-90">{{ page_description }}</p>
</div>
```

#### Card Component Pattern
```jinja2
<div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
    <div class="flex items-center space-x-4 mb-4">
        <i class="fas fa-icon text-2xl text-blue-600"></i>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Title</h3>
    </div>
    <p class="text-gray-600 dark:text-gray-300">Description</p>
</div>
```

#### Form Pattern
```jinja2
<form class="space-y-6">
    <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Label
        </label>
        <input type="text" 
               class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                      rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
    </div>
</form>
```

## 📞 Support and Documentation

### Additional Resources
1. **Jinja2 Documentation**: Template syntax and features
2. **Tailwind CSS Guide**: Styling utilities and responsive design
3. **FastAPI Documentation**: Route integration and dependencies
4. **Updated UI README**: Component framework documentation

### Best Practices
- **Semantic HTML**: Use appropriate HTML5 semantic elements
- **Accessibility**: Follow WCAG 2.1 AA guidelines
- **Performance**: Optimize images and minimize DOM manipulation
- **Security**: Always validate and sanitize user inputs
- **Maintainability**: Use consistent naming and structure

---

*Last updated: January 2025*
*Template System Version: 2.0.0*
