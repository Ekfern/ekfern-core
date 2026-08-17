/**
 * The shape of an invitation.
 *
 * An InviteConfig is one JSON document: page-level appearance plus an ordered
 * list of tiles. It is the unit every surface reads - the guest's invitation,
 * the page editor, the layout studio and the layout library all render from
 * this and nothing else.
 *
 * "Living Poster" was the original concept - one animated poster rather than a
 * scroll of tiles - and the name survived in this file long after the idea was
 * replaced. It is gone now; nothing here is a poster except the poster tile.
 */

export interface BackgroundImage {
  type: 'image'
  src: string
  parallax?: boolean
  // Background adjustment options
  fitMode?: 'cover' | 'contain' | 'picture-in-picture' | 'blur-fill'
  backgroundColor?: string // Extracted or user-selected color
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
  focusPoint?: { x: number; y: number } // 0-100, center of important content for responsive positioning
  scale?: number // 0.5 to 2.0
  originalAspectRatio?: { width: number; height: number }
  dominantColors?: string[] // Extracted dominant colors
}

// Tile-based structure
export type TileType = 'title' | 'gallery' | 'poster' | 'timer' | 'event-details' | 'directions' | 'description' | 'feature-buttons' | 'footer' | 'event-carousel'

export interface TitleTileSettings {
  text: string
  font?: string // Font family from FONT_OPTIONS
  color?: string // Hex color
  size?: 'small' | 'medium' | 'large' | 'xlarge' // Title size option (preset)
  textAlign?: 'left' | 'center' | 'right' // Default: center
  // Small kicker/label line rendered above the headline (e.g. "SAVE THE DATE", editorial masthead style)
  eyebrow?: string
  eyebrowColor?: string // Hex color; defaults to theme primary accent
  // Optional second line (e.g. "Request the pleasure of your company…")
  subtitle?: string
  subtitleFont?: string
  subtitleColor?: string
  subtitleSize?: 'small' | 'medium' | 'large'
  overlayPosition?: { x: number; y: number } // % position when overlaying on image tile
}

export interface TextOverlay {
  id: string
  text: string
  x: number         // % from left edge of 9:16 container (card designer coordinate)
  y: number         // % from top edge of 9:16 container (card designer coordinate)
  width: number     // % of container width
  height?: number | null  // % of container height, null/undefined = auto
  fontFamily: string
  fontSize: number  // px
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  textAlign: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  shadowColor?: string
  shadowX?: number
  shadowY?: number
  shadowBlur?: number
  shadowOpacity?: number
}

/** How many photos a gallery may hold. A wedding invitation is not an album. */
export const GALLERY_MAX_IMAGES = 6

export interface GalleryImage {
  /** Stable across reordering, so React keys and drag order stay honest. */
  id: string
  src: string
  caption?: string
}

export interface GalleryTileSettings {
  images: GalleryImage[]
  /**
   * vertical   — one per row, full width
   * horizontal — side by side, wrapping onto further rows on narrow screens
   * grid       — two columns
   */
  arrangement?: 'vertical' | 'horizontal' | 'grid'
  /** One frame for every photo in the gallery; no mixing. */
  frame?: 'none' | 'simple' | 'polaroid'
  frameColor?: string // 'simple' only
  frameWidth?: number // 'simple' only, pixels
  // Shared vocabulary with the event carousel, so hosts learn one set of words.
  spacing?: 'tight' | 'normal' | 'spacious'
  cornerRadius?: number
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

export interface PosterTileSettings {
  src?: string                  // Image URL or data URL
  backgroundGradient?: string   // CSS gradient when no image e.g. 'linear-gradient(135deg, #fce4ec, #f48fb1)'
  textOverlays?: TextOverlay[]  // Positioned text boxes from the card designer (9:16 coordinate system)
  // How the source image fills the 9:16 card frame.
  //   'cover'   (default) — fills the frame and crops sides/top to fit
  //   'contain' — shows the entire image, may letterbox if aspect mismatches 9:16
  // Auto-generated layouts use 'contain' so user-uploaded cards aren't cropped.
  imageFit?: 'cover' | 'contain'
  // 'card' (default): today's small inset 9:16 postcard, max-width constrained.
  // 'full-bleed': fills the full page width as a hero panel, aspectRatio controls height.
  frameMode?: 'card' | 'full-bleed'
  aspectRatio?: string // CSS aspect-ratio value, only used when frameMode is 'full-bleed' (default '4/5')
  // Marks backgroundGradient/textOverlays as part of THIS layout's own baked-in identity
  // (not a staff-authored photo choice) so the Layout gallery's skeletonize step — which
  // hides staff photos pre-Design-step — preserves them instead of wiping them out.
  isLayoutHero?: boolean
  // Texture confined to this tile's own box (e.g. grain on a full-bleed hero) instead of
  // the page-wide texture, which would otherwise paint every tile uniformly.
  texture?: TextureSettings
}

export interface TimerTileSettings {
  enabled: boolean
  format: 'circle' | 'inline' // Circle format: (12) Days (20) Hours | Inline: Days:Hours:Mins
  circleColor?: string // Color for circles (hex color or 'transparent')
  textColor?: string // Color for timer text (hex color)
}

export interface EventDetailsTileSettings {
  location: string // Display text for location (flexible, e.g., "Grand Ballroom", "Beachside Venue")
  date: string // ISO date string
  time?: string // Time string (e.g., "18:00")
  dressCode?: string
  mapUrl?: string // Map location - accepts address text or Google Maps URL (auto-validated and verified)
  locationVerified?: boolean // Auto-set by system based on map location validation (true if valid, false if invalid)
  coordinates?: {
    lat: number
    lng: number
  } // Optional precise coordinates (auto-verifies when provided)
  showMap?: boolean // Option to display embedded map (only works if mapUrl is provided and valid and location is verified)
  mapZoom?: number // Zoom level for embedded map (11-20: 11-15 for city/area view, 16-20 for street view, default: 15)
  fontColor?: string // Font color for event details text (hex color, e.g., "#000000")
  buttonColor?: string // Hex color for Save the Date button (e.g., "#1F2937")
  headerFontFamily?: string
  contentFontFamily?: string
  buttonVariant?: 'classic' | 'gloss' | 'soft' | 'metal' | 'raised' | 'glow' | 'bracket' | 'ornate' | 'glass' | 'link' // Save the Date button style (default: classic)
  buttonRadius?: 'sharp' | 'subtle' | 'round' | 'pill' // Save the Date button corner radius (default: round)
  textAlign?: 'left' | 'center' | 'right' // Default: center
  // Date block layout: single-line (default) or day-prominent (large day number, smaller weekday/month/year/time)
  dateLayout?: 'single-line' | 'day-prominent'
  // Border styling options ('glass' = frosted blur card, ignores decorative border/symbol rendering)
  borderStyle?: 'elegant' | 'minimal' | 'ornate' | 'modern' | 'classic' | 'vintage' | 'none' | 'glass'
  borderColor?: string // Hex color for borders (default: based on borderStyle)
  borderWidth?: number // 1-4 pixels (default: 1)
  decorativeSymbol?: string // Custom symbol (❦, ✿, ✤, ✦, •, —, or empty)
  backgroundColor?: string // Background color for the tile (default: transparent or gray-50)
  borderRadius?: number // 0-24 pixels (default: 0 for preview, 4 for non-preview)
}

export interface DirectionsTileSettings {
  /**
   * Where the guest is going. Accepts an address, a Google Maps URL, or iframe
   * embed code - the same input Event Details used to take, now owned by the
   * tile that renders it.
   */
  mapUrl?: string
  coordinates?: {
    lat: number
    lng: number
  }
  locationVerified?: boolean // Auto-set by the system from map location validation
  heading?: string // Defaults to "Getting there"
  /** Address line shown under the map; falls back to the event's location. */
  addressLine?: string
  height?: number // Map height in pixels (default 260)
  /**
   * How closely the map frames the venue (default 16 - street and surrounds).
   * The embed is always rebuilt around the destination, so a pasted link that
   * happened to be showing a whole country does not become the invitation's map.
   */
  zoom?: number
  /** How the map is treated. See lib/invite/mapStyles.ts. */
  mapStyle?: 'standard' | 'vintage' | 'muted'
  fontColor?: string
  textAlign?: 'left' | 'center' | 'right'
}

export interface DescriptionTileSettings {
  content: string // Rich text/markdown content
  fontColor?: string // Hex color; use for contrast on dark themes
  textAlign?: 'left' | 'center' | 'right' // Default: center
}

export interface FeatureButtonsTileSettings {
  buttonColor?: string // Hex color for buttons
  rsvpLabel?: string // Custom label for RSVP button (default: "RSVP")
  registryLabel?: string // Custom label for catalog button on invite (optional override)
  buttonVariant?: 'classic' | 'gloss' | 'soft' | 'metal' | 'raised' | 'glow' | 'bracket' | 'ornate' | 'glass' | 'link'
  buttonRadius?: 'sharp' | 'subtle' | 'round' | 'pill'
  // Optional boxed "card" treatment around the whole buttons tile (Luma-style "Get Tickets" card).
  // Unset/'none' preserves today's borderless look exactly.
  ctaCardStyle?: 'none' | 'bordered' | 'glass'
  ctaCardBackgroundColor?: string // Hex color for 'bordered' card fill (default: '#FFFFFF')
  ctaCardBorderColor?: string // Hex color for 'bordered' card border
  ctaCardShadow?: boolean // Drop shadow on the card (default: true when ctaCardStyle is set)
  ctaCardLabel?: string // Small heading inside the card, e.g. "Get Tickets"
}

export interface FooterTileSettings {
  text: string
  fontColor?: string // Hex color; use theme fg on dark backgrounds for contrast
  showDivider?: boolean // Hairline top border above the footer text (default: true)
}

export interface EventCarouselTileSettings {
  showFields: {
    image?: boolean
    title?: boolean
    dateTime?: boolean
    location?: boolean
    cta?: boolean
  }
  // Slideshow controls
  autoPlay?: boolean // Default: true
  autoPlayInterval?: number // Default: 5000, range: 3000-10000
  showArrows?: boolean // Default: true
  showDots?: boolean // Default: true
  // Card styling presets
  cardStyle?: 'minimal' | 'elegant' | 'modern' | 'classic' // Default: 'elegant'
  cardLayout?: 'full-width' | 'centered' | 'grid' // Default: 'centered'
  cardSpacing?: 'tight' | 'normal' | 'spacious' // Default: 'normal'
  // Card customization
  cardBackgroundColor?: string // Hex color, default: '#ffffff'
  cardBorderRadius?: number // 0-24, default: 12
  cardShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl' // Default: 'md'
  cardBorderWidth?: number // 0-4, default: 0
  cardBorderColor?: string // Hex color
  cardBorderStyle?: 'solid' | 'dashed' // Default: 'solid'
  cardPadding?: 'tight' | 'normal' | 'spacious' // Default: 'normal'
  // Image settings
  imageHeight?: 'small' | 'medium' | 'large' | 'full' // Default: 'medium'
  imageAspectRatio?: '16:9' | '4:3' | '1:1' | 'auto' // Default: '16:9'
  // Global styling for sub-events (applies uniformly to all sub-events)
  subEventTitleStyling?: {
    font?: string // Font family from FONT_OPTIONS
    color?: string // Hex color
    size?: 'small' | 'medium' | 'large' | 'xlarge'
  }
  subEventDetailsStyling?: {
    fontColor?: string // Hex color for date/time and location text
  }
}

export type TextureType =
  | 'none'
  | 'paper-grain'
  | 'linen'
  | 'canvas'
  | 'parchment'
  | 'vintage-paper'
  | 'silk'
  | 'marble'
  | 'grain' // Modern film-grain/noise overlay (SVG turbulence) — for rich saturated gradient backgrounds

export interface TextureSettings {
  type: TextureType
  intensity?: number // 0-100, default 20
  imageUrl?: string // Optional texture image (e.g. marble photo, watercolor)
  textureBlend?: 'overlay' | 'replace' // When imageUrl set: overlay on background, or replace CSS texture
}

export interface LinkMetadata {
  title?: string // Custom title for link previews (WhatsApp, Facebook, Twitter) - overrides auto-generated
  description?: string // Custom description for link previews - overrides auto-generated
  image?: string // Custom image URL for link previews - overrides auto-generated (recommended: 1200x630px)
  previewImageOriginal?: string // Original uploaded image URL for re-editing framing
  previewImageCrop?: { x: number; y: number; width: number; height: number } // Crop rectangle in original image coordinates
  previewImageCropAspectRatio?: number // Aspect ratio used when cropping (e.g., 1200/630)
  previewImageSource?: 'upload' | 'poster' | 'gallery' // Which source drives the OG image
  previewTitleSource?: 'auto' | 'custom' // Whether to use auto-generated or custom title
  previewDescriptionSource?: 'auto' | 'custom' // Whether to use auto-generated or custom description
}

export type RsvpFieldType = 'text' | 'number' | 'select' | 'radio' | 'checkbox'

export interface RsvpFieldOption {
  label: string
  value: string
}

export interface RsvpSystemFieldConfig {
  enabled: boolean
  label?: string
  helpText?: string
}

export interface RsvpCustomFieldConfig {
  /** Normalized guest custom field key (must exist in guest management). */
  key: string
  enabled: boolean
  required?: boolean
  label?: string
  helpText?: string
  type: RsvpFieldType
  options?: RsvpFieldOption[] // required for select/radio
}

export interface RsvpFormConfig {
  version: 1
  systemFields?: {
    notes?: RsvpSystemFieldConfig
    email?: RsvpSystemFieldConfig
    guests_count?: RsvpSystemFieldConfig
  }
  customFields?: RsvpCustomFieldConfig[]
  /** If true, answers are copied into Guest.custom_fields when the RSVP matches a guest. */
  writeBackToGuest?: boolean
}

export type TileSettings =
  | TitleTileSettings
  | GalleryTileSettings
  | PosterTileSettings
  | TimerTileSettings
  | EventDetailsTileSettings
  | DirectionsTileSettings
  | DescriptionTileSettings
  | FeatureButtonsTileSettings
  | FooterTileSettings
  | EventCarouselTileSettings

export interface Tile {
  id: string
  type: TileType
  enabled: boolean
  order: number // Saved order (snapshot when save button clicked) - used by invite page
  previewOrder?: number // Real-time order for mobile preview (not saved to backend)
  settings: TileSettings
  overlayTargetId?: string // If set, this title tile overlays on top of the target tile (image)
}

export interface InviteConfig {
  // id of the InvitePageLayout this config was last cloned from (via applyLayout).
  // Lets the Layout step highlight what's currently applied when you revisit it.
  // Not updated by hand-edits in Design/Page Editor — only by re-applying a layout.
  appliedLayoutId?: string
  // Custom overrides (optional - if not set, uses theme defaults)
  customColors?: {
    backgroundColor?: string // Overrides theme.palette.bg
    backgroundGradient?: string // CSS gradient string e.g. 'linear-gradient(160deg, #E8D8C3 0%, #C4A882 100%)' — takes precedence over backgroundColor
    fontColor?: string // Overrides theme.palette.fg
    primaryColor?: string // Overrides theme.palette.primary
    mutedColor?: string // Overrides theme.palette.muted
  }
  // `| null` here (and on the visual fields below) is meaningful, not just
  // plain omission: applyLayout() and the Page Editor send explicit null for
  // visual fields a layout recipe doesn't define, so that switching layouts /
  // clearing a setting actually removes a leftover value from a previous
  // layout/Page Editor session instead of the backend's save-merge (see
  // update_design) preserving it by mistake.
  customFonts?: {
    titleFont?: string // Overrides theme.fonts.title
    bodyFont?: string // Overrides theme.fonts.body
  } | null
  // Background texture (CSS-based)
  texture?: TextureSettings | null
  // Page border settings.
  pageBorder?: {
    enabled?: boolean // Enable/disable page border (default: false)
    style?: 'solid' | 'dotted' | 'dashed' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset' | 'intaglio' // Border style
    color?: string // Hex color for border (default: '#D1D5DB')
    width?: number // Border width in pixels (default: 2)
  } | null
  // Full-page frame image (ornate border/frame overlay, e.g. SVG or PNG with transparency)
  pageFrame?: {
    imageUrl?: string
  } | null
  // Corner decoration image URLs (optional flourishes in each corner)
  cornerDecorations?: {
    topLeft?: string
    topRight?: string
    bottomLeft?: string
    bottomRight?: string
  } | null
  // Animation settings
  animations?: {
    envelope?: boolean // Enable/disable envelope opening animation (default: true)
  } | null
  // Link preview metadata (Open Graph, Twitter Cards, WhatsApp)
  linkMetadata?: LinkMetadata | null
  // RSVP form configuration (host-managed)
  rsvpForm?: RsvpFormConfig | null
  // New tile-based structure
  tiles?: Tile[]
  // When true, design page must not merge in missing tile types (preserves template-defined tile set)
  tileSetComplete?: boolean
  // Global spacing between tiles
  spacing?: 'tight' | 'normal' | 'spacious' | null
  // Legacy structure (for backward compatibility)
  hero?: {
    background?: BackgroundImage | {
      type: 'video' | 'gradient'
      src?: string
      gradientFrom?: string
      gradientTo?: string
      parallax?: boolean
    }
    eventType?: string
    title: string
    subtitle?: string
    showTimer: boolean
    eventDate?: string // ISO string
    buttons: Array<{
      label: 'Save the Date' | 'RSVP' | 'Registry' | 'Gift Catalog'
      action: 'calendar' | 'rsvp' | 'registry'
      href?: string
    }>
  }
  descriptionMarkdown?: string
  location?: {
    name?: string
    address?: string
    lat?: number
    lng?: number
  }
}

export interface InvitePage {
  id: number
  event: number
  event_slug: string
  slug: string
  background_url: string
  config: InviteConfig
  /** Live snapshot served to guests. Null until first publish. */
  published_config?: InviteConfig | null
  is_published: boolean
  /** Timestamp of last publish; retained when pulled back. */
  published_at?: string | null
  show_branding?: boolean
  rsvp_count?: number
  created_at: string
  updated_at: string
}

