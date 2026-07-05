// Typography Creator Figma Plugin

interface GenerateSettings {
  baseSize: number;
  scaleRatio: number;
  prefix: string;
  saveLocalStyles: boolean;
  generateSpecimen: boolean;
  weights: string[];
  fontMapping: { [key: string]: string };
}

// Map of standard font weights to fuzzy matches in font styles
function getClosestFontStyle(availableStyles: string[] | undefined, targetWeight: string): string {
  if (!availableStyles || availableStyles.length === 0) return 'Regular';
  const lowerTarget = targetWeight.toLowerCase();

  const exact = availableStyles.find(s => s.toLowerCase() === lowerTarget);
  if (exact) return exact;

  if (lowerTarget === 'regular' || lowerTarget === 'normal') {
    const regularTerms = ['regular', 'normal', 'book', 'plain', 'roman'];
    for (const term of regularTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }
  if (lowerTarget === 'medium') {
    const mediumTerms = ['medium', 'semibold', 'regular'];
    for (const term of mediumTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }
  if (lowerTarget === 'semibold' || lowerTarget === 'demibold') {
    const semiboldTerms = ['semibold', 'demibold', 'medium', 'bold'];
    for (const term of semiboldTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }
  if (lowerTarget === 'bold') {
    const boldTerms = ['bold', 'heavy', 'black', 'semibold'];
    for (const term of boldTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }
  if (lowerTarget === 'extrabold' || lowerTarget === 'ultrabold') {
    const extraboldTerms = ['extrabold', 'ultrabold', 'bold', 'black'];
    for (const term of extraboldTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }
  if (lowerTarget === 'black' || lowerTarget === 'heavy') {
    const heavyTerms = ['black', 'heavy', 'bold'];
    for (const term of heavyTerms) {
      const match = availableStyles.find(s => s.toLowerCase().includes(term));
      if (match) return match;
    }
  }

  return availableStyles[0] || 'Regular';
}

// Letter spacing calculator based on design best practices
function calculateLetterSpacing(size: number, category: string): LetterSpacing {
  if (category === 'display') {
    return { unit: 'PERCENT', value: -2 };
  } else if (category === 'headings') {
    return { unit: 'PERCENT', value: -1 };
  } else if (category === 'caption') {
    return { unit: 'PERCENT', value: 1.5 };
  } else if (category === 'overline') {
    return { unit: 'PERCENT', value: 5 };
  }
  return { unit: 'PERCENT', value: 0 };
}

// Safely load fonts with robust fallback
async function safeLoadFont(fontName: FontName): Promise<FontName> {
  try {
    await figma.loadFontAsync(fontName);
    return fontName;
  } catch (_e) {
    console.warn(`Failed to load font ${fontName.family} ${fontName.style}, falling back to Inter Regular.`);
    const fallback = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(fallback);
    return fallback;
  }
}

// Main logic triggered when Figma runs the plugin
if (figma.editorType === 'figma' || figma.editorType === 'slides' || figma.editorType === 'figjam') {
  // Show UI with customized height
  figma.showUI(__html__, { width: 400, height: 580, title: "Typography Creator" });

  // 1. Fetch system fonts and send to UI
  figma.listAvailableFontsAsync().then(fonts => {
    const fontMap = new Map<string, Set<string>>();
    for (const font of fonts) {
      const { family, style } = font.fontName;
      if (!fontMap.has(family)) {
        fontMap.set(family, new Set());
      }
      fontMap.get(family)!.add(style);
    }
    const groupedFonts = Array.from(fontMap.entries()).map(([family, stylesSet]) => ({
      family,
      styles: Array.from(stylesSet)
    })).sort((a, b) => a.family.localeCompare(b.family));

    figma.ui.postMessage({ type: 'fonts-loaded', groupedFonts });
  }).catch(err => {
    figma.notify("Failed to list system fonts. Using fallback dropdown.", { error: true });
    console.error(err);
    figma.ui.postMessage({ type: 'fonts-loaded', groupedFonts: [{ family: 'Inter', styles: ['Regular', 'Bold'] }] });
  });

  // 2. Handle events from the UI
  figma.ui.onmessage = async (msg) => {
    if (msg.type === 'cancel') {
      figma.closePlugin();
      return;
    }

    if (msg.type === 'generate-typography') {
      const settings: GenerateSettings = msg.settings;
      const notification = figma.notify("Generating typography system...", { timeout: Infinity });

      try {
        // Collect all available system styles
        const systemFonts = await figma.listAvailableFontsAsync();
        const fontStylesMap = new Map<string, string[]>();
        for (const f of systemFonts) {
          const fam = f.fontName.family;
          const sty = f.fontName.style;
          if (!fontStylesMap.has(fam)) {
            fontStylesMap.set(fam, []);
          }
          fontStylesMap.get(fam)!.push(sty);
        }

        // Define typography hierarchy steps
        const levels = [
          { key: 'display1', name: 'Display 1', index: 7, category: 'display' },
          { key: 'display2', name: 'Display 2', index: 6, category: 'display' },
          { key: 'h1', name: 'Heading 1', index: 5, category: 'headings' },
          { key: 'h2', name: 'Heading 2', index: 4, category: 'headings' },
          { key: 'h3', name: 'Heading 3', index: 3, category: 'headings' },
          { key: 'h4', name: 'Heading 4', index: 2, category: 'headings' },
          { key: 'bodyLg', name: 'Body Large', index: 1, category: 'body' },
          { key: 'bodyMd', name: 'Body Medium', index: 0, category: 'body' },
          { key: 'bodySm', name: 'Body Small', index: -1, category: 'body' },
          { key: 'button', name: 'Button', index: 0, category: 'body' },
          { key: 'caption', name: 'Caption', index: -2, category: 'caption' },
          { key: 'overline', name: 'Overline', index: -3, category: 'caption' }
        ];

        // Store mappings from Style Name to TextStyle ID for specimen binding
        const createdStylesMap = new Map<string, string>();

        // Phase A: Generate Local Figma Text Styles if option is checked
        if (settings.saveLocalStyles && typeof figma.createTextStyle === 'function') {
          const localStyles = await figma.getLocalTextStylesAsync();

          for (const level of levels) {
            const baseSize = settings.baseSize;
            const ratio = settings.scaleRatio;
            let size = baseSize * Math.pow(ratio, level.index);
            size = Math.round(size * 10) / 10;
            if (size < 8) size = 8;

            let lhMultiplier = 1.3;
            if (level.category === 'display') lhMultiplier = 1.15;
            else if (level.category === 'headings') lhMultiplier = 1.25;
            else if (level.category === 'body') lhMultiplier = 1.5;
            else if (level.category === 'caption') lhMultiplier = 1.4;

            let lineHeight = Math.round((size * lhMultiplier) / 4) * 4;
            if (lineHeight < size + 4) {
              lineHeight = Math.ceil(size / 4) * 4 + 4;
            }

            const familyName = settings.fontMapping[level.category] || 'Inter';
            const availableStyles = fontStylesMap.get(familyName);

            for (const weight of settings.weights) {
              const actualStyle = getClosestFontStyle(availableStyles, weight);
              const loadedFont = await safeLoadFont({ family: familyName, style: actualStyle });

              const styleName = `${settings.prefix} / ${level.name} / ${weight}`;
              let textStyle = localStyles.find(s => s.name === styleName);
              if (!textStyle) {
                textStyle = figma.createTextStyle();
                textStyle.name = styleName;
              }

              textStyle.fontName = loadedFont;
              textStyle.fontSize = size;
              textStyle.lineHeight = { unit: 'PIXELS', value: lineHeight };
              textStyle.letterSpacing = calculateLetterSpacing(size, level.category);

              createdStylesMap.set(`${level.key}-${weight}`, textStyle.id);
            }
          }
        }

        // Phase B: Generate Specimen Frame in current workspace
        if (settings.generateSpecimen) {
          // Load Inter Regular for metadata/headings
          const labelFont = await safeLoadFont({ family: 'Inter', style: 'Regular' });
          const labelBoldFont = await safeLoadFont({ family: 'Inter', style: 'Bold' });

          // 1. Create main board frame
          const board = figma.createFrame();
          board.name = `${settings.prefix} Typography System`;
          board.layoutMode = 'VERTICAL';
          board.resize(1000, 100); // Starting width 1000, height 100
          board.primaryAxisSizingMode = 'AUTO'; // height hugs (set after resize!)
          board.counterAxisSizingMode = 'FIXED'; // width fixed (set after resize!)
          board.itemSpacing = 0; // Spacing is handled by dividers and padding
          board.paddingLeft = 48;
          board.paddingRight = 48;
          board.paddingTop = 48;
          board.paddingBottom = 48;
          board.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
          board.cornerRadius = 16;
          
          // Subtle frame drop shadow
          board.effects = [{
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.05 },
            offset: { x: 0, y: 4 },
            radius: 24,
            visible: true,
            blendMode: 'NORMAL'
          }];

          // 2. Create Header
          const header = figma.createFrame();
          header.name = 'Header';
          header.layoutMode = 'VERTICAL';
          header.layoutAlign = 'STRETCH';
          header.itemSpacing = 8;
          header.paddingBottom = 32;
          header.fills = [];
          header.resize(board.width - board.paddingLeft - board.paddingRight, 10);
          header.primaryAxisSizingMode = 'AUTO'; // height hugs (set after resize!)
          header.counterAxisSizingMode = 'FIXED'; // width fixed (set after resize!)

          const title = figma.createText();
          title.fontName = labelBoldFont;
          title.fontSize = 32;
          title.characters = 'Typography system:';
          title.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
          header.appendChild(title);

          const subtitle = figma.createText();
          subtitle.fontName = labelFont;
          subtitle.fontSize = 14;
          subtitle.characters = 'Design system text styles that used in all scope of a project.';
          subtitle.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
          header.appendChild(subtitle);

          const details = figma.createText();
          details.fontName = labelFont;
          details.fontSize = 11;
          details.characters = `Base Size: ${settings.baseSize}px   •   Scale Ratio: ${settings.scaleRatio}   •   Primary: ${settings.fontMapping.display}   •   Secondary: ${settings.fontMapping.body}`;
          details.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
          header.appendChild(details);

          board.appendChild(header);

          // 3. Grid Column Headers
          const gridHeaders = figma.createFrame();
          gridHeaders.name = 'Grid Headers';
          gridHeaders.layoutMode = 'HORIZONTAL';
          gridHeaders.layoutAlign = 'STRETCH';
          gridHeaders.itemSpacing = 24;
          gridHeaders.paddingLeft = 24;
          gridHeaders.paddingRight = 24;
          gridHeaders.paddingTop = 12;
          gridHeaders.paddingBottom = 12;
          gridHeaders.fills = [];
          gridHeaders.resize(board.width - board.paddingLeft - board.paddingRight, 10);
          gridHeaders.primaryAxisSizingMode = 'FIXED'; // width is fixed/stretched (set after resize!)
          gridHeaders.counterAxisSizingMode = 'AUTO'; // height hugs content (set after resize!)
          gridHeaders.counterAxisAlignItems = 'CENTER'; // Center vertically

          const col1Header = figma.createText();
          col1Header.fontName = labelBoldFont;
          col1Header.fontSize = 10;
          col1Header.characters = 'OPTIONS';
          col1Header.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
          col1Header.resize(220, 10);
          col1Header.textAutoResize = 'HEIGHT';
          gridHeaders.appendChild(col1Header);

          const col2Header = figma.createText();
          col2Header.fontName = labelBoldFont;
          col2Header.fontSize = 10;
          col2Header.characters = 'STYLE';
          col2Header.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
          col2Header.layoutGrow = 1;
          col2Header.textAutoResize = 'HEIGHT';
          gridHeaders.appendChild(col2Header);

          const col3Header = figma.createText();
          col3Header.fontName = labelBoldFont;
          col3Header.fontSize = 10;
          col3Header.characters = 'APPLIED COLORS';
          col3Header.fills = [{ type: 'SOLID', color: { r: 0.55, g: 0.55, b: 0.55 } }];
          col3Header.resize(160, 10);
          col3Header.textAutoResize = 'HEIGHT';
          col3Header.textAlignHorizontal = 'RIGHT';
          gridHeaders.appendChild(col3Header);

          board.appendChild(gridHeaders);

          // Divider Line after headers
          const headerDivider = figma.createRectangle();
          headerDivider.name = 'Header Divider';
          headerDivider.layoutAlign = 'STRETCH';
          headerDivider.resize(board.width - board.paddingLeft - board.paddingRight, 1);
          headerDivider.fills = [{ type: 'SOLID', color: { r: 0.85, g: 0.85, b: 0.85 } }];
          board.appendChild(headerDivider);

          // 4. Generate Level Rows
          for (const level of levels) {
            const baseSize = settings.baseSize;
            const ratio = settings.scaleRatio;
            let size = baseSize * Math.pow(ratio, level.index);
            size = Math.round(size * 10) / 10;
            if (size < 8) size = 8;

            let lhMultiplier = 1.3;
            if (level.category === 'display') lhMultiplier = 1.15;
            else if (level.category === 'headings') lhMultiplier = 1.25;
            else if (level.category === 'body') lhMultiplier = 1.5;
            else if (level.category === 'caption') lhMultiplier = 1.4;

            let lineHeight = Math.round((size * lhMultiplier) / 4) * 4;
            if (lineHeight < size + 4) {
              lineHeight = Math.ceil(size / 4) * 4 + 4;
            }

            const familyName = settings.fontMapping[level.category] || 'Inter';
            const availableStyles = fontStylesMap.get(familyName);

            for (const weight of settings.weights) {
              const actualStyle = getClosestFontStyle(availableStyles, weight);
              const loadedFont = await safeLoadFont({ family: familyName, style: actualStyle });

              // Row Container
              const row = figma.createFrame();
              row.name = `Row: ${level.name} (${weight})`;
              row.layoutMode = 'HORIZONTAL';
              row.layoutAlign = 'STRETCH';
              row.itemSpacing = 24;
              row.paddingLeft = 24;
              row.paddingRight = 24;
              row.paddingTop = 20;
              row.paddingBottom = 20;
              row.fills = [];
              row.resize(board.width - board.paddingLeft - board.paddingRight, 10);
              row.primaryAxisSizingMode = 'FIXED'; // width is fixed/stretched (set after resize!)
              row.counterAxisSizingMode = 'AUTO'; // height hugs content (set after resize!)
              row.counterAxisAlignItems = 'CENTER'; // Center vertically

              // Col 1: Metadata Card (width: 220)
              const metaCard = figma.createFrame();
              metaCard.name = 'Metadata';
              metaCard.layoutMode = 'VERTICAL';
              metaCard.itemSpacing = 4;
              metaCard.fills = [];
              metaCard.resize(220, 10);
              metaCard.primaryAxisSizingMode = 'AUTO'; // height hugs (set after resize!)
              metaCard.counterAxisSizingMode = 'FIXED'; // width fixed (set after resize!)

              const fontNameText = figma.createText();
              fontNameText.fontName = labelBoldFont;
              fontNameText.fontSize = 11;
              fontNameText.characters = `${familyName} ${actualStyle}`;
              fontNameText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
              metaCard.appendChild(fontNameText);

              const sizeText = figma.createText();
              sizeText.fontName = labelFont;
              sizeText.fontSize = 10;
              sizeText.characters = `${size} / ${lineHeight}`;
              sizeText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
              metaCard.appendChild(sizeText);

              row.appendChild(metaCard);

              // Col 2: Style Preview (layoutGrow = 1)
              const textNode = figma.createText();
              textNode.fontName = loadedFont;
              textNode.fontSize = size;
              textNode.lineHeight = { unit: 'PIXELS', value: lineHeight };
              textNode.letterSpacing = calculateLetterSpacing(size, level.category);

              // Custom natural text based on level name
              let sampleText = `${level.name}`;
              if (level.category === 'display') {
                sampleText = `${level.name} Headline`;
              } else if (level.category === 'headings') {
                sampleText = `${level.name} Headline`;
              } else if (level.category === 'body') {
                sampleText = `Body text`;
              } else if (level.key === 'button') {
                sampleText = `BUTTON`;
              } else if (level.key === 'overline') {
                sampleText = `OVERLINE`;
              }
              
              textNode.characters = sampleText;
              textNode.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.12, b: 0.12 } }];
              textNode.layoutGrow = 1;
              textNode.textAutoResize = 'HEIGHT'; // Wrap layout

              // Bind TextStyle link if available
              const styleKey = `${level.key}-${weight}`;
              if (settings.saveLocalStyles && createdStylesMap.has(styleKey)) {
                await textNode.setTextStyleIdAsync(createdStylesMap.get(styleKey) as string);
              }

              row.appendChild(textNode);

              // Col 3: Applied Colors (width: 160)
              const colorsCard = figma.createFrame();
              colorsCard.name = 'Colors';
              colorsCard.layoutMode = 'HORIZONTAL';
              colorsCard.fills = [];
              colorsCard.primaryAxisAlignItems = 'MAX'; // Right aligned
              colorsCard.resize(160, 10);
              colorsCard.primaryAxisSizingMode = 'FIXED'; // width fixed (set after resize!)
              colorsCard.counterAxisSizingMode = 'AUTO'; // height hugs content (set after resize!)
              colorsCard.counterAxisAlignItems = 'CENTER'; // Center vertically

              const colorsText = figma.createText();
              colorsText.fontName = labelFont;
              colorsText.fontSize = 11;
              colorsText.characters = 'White 100 | Black 70';
              colorsText.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.45, b: 0.45 } }];
              colorsCard.appendChild(colorsText);

              row.appendChild(colorsCard);

              board.appendChild(row);

              // Row separator
              const rowDivider = figma.createRectangle();
              rowDivider.name = 'Row Divider';
              rowDivider.layoutAlign = 'STRETCH';
              rowDivider.resize(board.width - board.paddingLeft - board.paddingRight, 1);
              rowDivider.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];
              board.appendChild(rowDivider);
            }
          }

          // Clean up last trailing row divider
          if (board.children.length > 0) {
            const lastChild = board.children[board.children.length - 1];
            if (lastChild.name === 'Row Divider') {
              lastChild.remove();
            }
          }

          // Center the viewport on the newly created Board
          figma.currentPage.appendChild(board);
          figma.currentPage.selection = [board];
          figma.viewport.scrollAndZoomIntoView([board]);
        }

        notification.cancel();
        figma.notify(`Typography system "${settings.prefix}" created successfully!`);
      } catch (err) {
        notification.cancel();
        console.error(err);
        figma.notify("Error generating typography system: " + String(err), { error: true });
      } finally {
        figma.closePlugin();
      }
    }
  };
}
