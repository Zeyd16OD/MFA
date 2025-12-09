# Material Theme Implementation

## Overview
The application has been updated to use Material Design 3 theme specifications with a green-based color scheme (#63A002 as the primary seed color).

## Theme Specifications

### Color Palette
The theme uses a comprehensive Material Design 3 color system:

**Primary Colors:**
- Primary: `rgb(76 102 43)` - Dark olive green
- Primary Container: `rgb(205 237 163)` - Light green
- On Primary: White
- On Primary Container: `rgb(53 78 22)` - Very dark green

**Secondary Colors:**
- Secondary: `rgb(88 98 73)` - Muted sage green
- Secondary Container: `rgb(220 231 200)` - Pale green
- On Secondary: White
- On Secondary Container: `rgb(64 74 51)` - Dark sage

**Tertiary Colors:**
- Tertiary: `rgb(56 102 99)` - Teal
- Tertiary Container: `rgb(188 236 231)` - Light cyan
- On Tertiary: White
- On Tertiary Container: `rgb(31 78 75)` - Dark teal

**Surface & Background:**
- Background: `rgb(249 250 239)` - Off-white with green tint
- Surface: `rgb(249 250 239)` - Off-white
- Surface Container: Multiple levels (lowest, low, default, high, highest)
- On Surface: `rgb(26 28 22)` - Almost black
- On Surface Variant: `rgb(68 72 61)` - Dark gray-green

**Error Colors:**
- Error: `rgb(186 26 26)` - Red
- Error Container: `rgb(255 218 214)` - Light pink
- On Error: White
- On Error Container: `rgb(147 0 10)` - Dark red

### Dark Mode Support
The theme includes full dark mode support with adjusted colors:
- Dark Background: `rgb(18 20 14)` - Very dark green-black
- Dark Surface: `rgb(18 20 14)` - Very dark
- Dark Primary: `rgb(177 209 138)` - Light green (inverted from light mode)
- All other colors adjusted for optimal dark mode contrast

## Implementation Details

### Files Modified

1. **tailwind.config.js**
   - Added dark mode class support
   - Extended color palette with Material theme colors
   - Configured primary, secondary, tertiary, error, surface, and outline colors

2. **index.css**
   - Added CSS custom properties for all Material theme colors
   - Defined `:root` for light theme variables
   - Defined `.dark` class for dark theme variables
   - Created reusable component classes:
     - `.btn-primary` - Primary action buttons
     - `.btn-secondary` - Secondary action buttons
     - `.card` - Container cards with rounded corners
     - `.input-field` - Form input fields with proper styling

3. **Login.jsx**
   - Updated background to use Material theme background color
   - Applied `.card` class to login container
   - Used Material theme colors for:
     - Headings (primary color)
     - Text (on-surface colors)
     - Error messages (error container colors)
     - Input fields (input-field class)
     - Buttons (btn-primary and btn-secondary classes)

4. **EmployeeDashboard.jsx**
   - Header uses primary color
   - Status banners use appropriate container colors (error, tertiary, primary)
   - Cards use `.card` class
   - All form inputs use `.input-field` class
   - Buttons use `.btn-primary` and `.btn-secondary` classes
   - Info section uses primary container color

5. **HRDashboard.jsx**
   - Header uses secondary color
   - Message cards use surface container colors
   - Decrypted content uses tertiary container (green highlight)
   - Encrypted content uses surface container highest
   - All interactive elements follow Material theme

6. **AdminDashboard.jsx**
   - Header uses tertiary color (teal)
   - Create user form uses `.card` and `.input-field` classes
   - System overview cards use surface container colors
   - Table uses Material theme surface and outline colors
   - Status badges use tertiary container colors

## Component Classes

### Button Classes
```css
.btn-primary - Main action buttons
  - Background: var(--md-sys-color-primary)
  - Color: var(--md-sys-color-on-primary)
  - Rounded pill shape
  - Shadow and hover effects

.btn-secondary - Secondary action buttons
  - Background: var(--md-sys-color-secondary-container)
  - Color: var(--md-sys-color-on-secondary-container)
  - Rounded pill shape
  - Hover opacity effect
```

### Card Class
```css
.card - Container component
  - Background: var(--md-sys-color-surface-container)
  - Color: var(--md-sys-color-on-surface)
  - Rounded corners (24px)
  - Shadow
  - Padding
```

### Input Class
```css
.input-field - Form inputs
  - Background: var(--md-sys-color-surface-container-highest)
  - Color: var(--md-sys-color-on-surface)
  - Border: var(--md-sys-color-outline)
  - Focus border: var(--md-sys-color-primary)
  - Rounded corners
  - Smooth transitions
```

## Color Usage Guidelines

### Role-Based Headers
- **Employee Dashboard**: Primary color (green) - `rgb(76 102 43)`
- **HR Dashboard**: Secondary color (sage) - `rgb(88 98 73)`
- **Admin Dashboard**: Tertiary color (teal) - `rgb(56 102 99)`

### Status Indicators
- **Success/Complete**: Tertiary container (light cyan) - `rgb(188 236 231)`
- **Error/Failed**: Error container (light pink) - `rgb(255 218 214)`
- **Info/Processing**: Primary container (light green) - `rgb(205 237 163)`

### Interactive Elements
- **Primary Actions**: Primary color buttons
- **Secondary Actions**: Secondary container buttons
- **Disabled States**: 50% opacity applied

## Accessibility
- All color combinations meet WCAG contrast requirements
- Text is clearly readable on all backgrounds
- Interactive elements have proper focus states
- Semantic color usage (error, success, warning)

## Browser Support
The theme uses:
- CSS Custom Properties (CSS Variables)
- Modern CSS features supported by all current browsers
- Fallback colors not needed as the application targets modern browsers

## Dark Mode Implementation
To enable dark mode, add the `dark` class to the root HTML element:
```javascript
document.documentElement.classList.add('dark');
```

## Viewing the Application
The application is now running with the Material Theme applied:
- Frontend: http://localhost:5174/
- Backend: http://localhost:8000

All dashboards now feature:
- Consistent green-based color scheme
- Material Design 3 rounded corners and elevation
- Proper color hierarchy and contrast
- Smooth transitions and hover states
- Professional, modern appearance
