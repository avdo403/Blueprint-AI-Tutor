import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot } from 'lucide-react';
import 'ueblueprint/dist/css/ueb-style.css';

export interface BlueprintNodeData {
  index: number;
  title: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NodeExplanation {
  index: number;
  explanation: string;
}

interface UEBlueprintProps {
  blueprintText: string;
  onNodesRendered?: (nodes: BlueprintNodeData[]) => void;
  nodeExplanations?: NodeExplanation[];
}

export const UEBlueprintViewer: React.FC<UEBlueprintProps> = ({ 
  blueprintText, 
  onNodesRendered,
  nodeExplanations = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [gridContentElement, setGridContentElement] = useState<HTMLElement | null>(null);
  const [renderedNodes, setRenderedNodes] = useState<BlueprintNodeData[]>([]);

  useEffect(() => {
    // Dynamically import to catch and ignore CustomElementRegistry errors during HMR
    import('ueblueprint').then(() => {
      setIsReady(true);
    }).catch((err) => {
      if (err.message && err.message.includes('has already been used')) {
        setIsReady(true); // Already registered, we can proceed
      } else {
        console.error('Failed to load ueblueprint:', err);
      }
    });
  }, []);

  useEffect(() => {
    if (isReady && containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      if (blueprintText.trim()) {
        try {
          // Use innerHTML to avoid "The result must not have attributes" error from document.createElement
          // when the custom element constructor illegally sets attributes.
          containerRef.current.innerHTML = `
            <ueb-blueprint style="--ueb-height: 100%; width: 100%; height: 100%;">
            </ueb-blueprint>
          `;
          
          const uebElement = containerRef.current.querySelector('ueb-blueprint') as any;
          
          if (uebElement) {
            const pasteBlueprint = () => {
              try {
                if (uebElement.template && typeof uebElement.template.getPasteInputObject === 'function') {
                  const pasteInput = uebElement.template.getPasteInputObject();
                  if (pasteInput && typeof pasteInput.pasted === 'function') {
                    pasteInput.pasted(blueprintText);
                    
                    // Extract nodes for debugging and AI
                    setTimeout(() => {
                      const nodes = Array.from(uebElement.querySelectorAll('ueb-node')) as HTMLElement[];
                      const gridContent = uebElement.querySelector('.ueb-grid-content') as HTMLElement;
                      
                      if (gridContent) {
                        setGridContentElement(gridContent);
                      }

                      const nodeData: BlueprintNodeData[] = nodes.map((n, i) => {
                        return {
                          index: i,
                          title: n.getAttribute('data-title') || 'Unknown',
                          type: n.getAttribute('data-type') || 'Unknown',
                          left: parseInt(n.style.left || '0', 10),
                          top: parseInt(n.style.top || '0', 10),
                          width: n.offsetWidth || 200,
                          height: n.offsetHeight || 100,
                        };
                      });
                      
                      setRenderedNodes(nodeData);
                      if (onNodesRendered) {
                        onNodesRendered(nodeData);
                      }
                    }, 200);
                  } else {
                    console.error('PasteInput object or pasted method not found');
                  }
                } else {
                  console.error('uebElement.template.getPasteInputObject is not available');
                }
              } catch (err) {
                console.error('Error pasting blueprint:', err);
              }
            };

            if (uebElement.updateComplete) {
              uebElement.updateComplete.then(pasteBlueprint).catch(console.error);
            } else {
              setTimeout(pasteBlueprint, 50);
            }
          }
        } catch (error) {
          console.error('Error rendering blueprint:', error);
          containerRef.current.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-red-500"><p>کۆدی بلوپرێنتەکە هەڵەی تێدایە یان نەتوانرا بخوێندرێتەوە.</p></div>';
        }
      }
    }
  }, [blueprintText, isReady]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-[#1e1e1e] overflow-hidden relative"
    >
      {gridContentElement && nodeExplanations.length > 0 && createPortal(
        <>
          {nodeExplanations.map((exp) => {
            const node = renderedNodes.find(n => n.index === exp.index);
            if (!node) return null;

            // Position the badge near the top right of the node
            const badgeLeft = node.left + node.width + 12;
            const badgeTop = node.top + 12;

            return (
              <div 
                key={exp.index} 
                className="group absolute"
                style={{ 
                  left: badgeLeft, 
                  top: badgeTop, 
                  zIndex: 150 
                }}
              >
                {/* AI Badge */}
                <div className="w-8 h-8 bg-blue-600 border-2 border-neutral-900 rounded-full flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.5)] hover:bg-blue-500 transition-colors animate-pulse group-hover:animate-none">
                  <Bot size={16} className="text-white" />
                </div>

                {/* Hover Popover Wrapper (includes invisible padding for hover bridge) */}
                <div className="absolute left-full top-0 pl-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[200]">
                  <div 
                    className="w-72 bg-neutral-900/95 backdrop-blur-sm border border-blue-500/50 rounded-xl p-4 shadow-2xl relative"
                    dir="rtl"
                    style={{ pointerEvents: 'auto' }}
                  >
                    {/* Pointer triangle */}
                    <div className="absolute top-3 -left-2 w-4 h-4 bg-neutral-900 border-l border-b border-blue-500/50 transform rotate-45"></div>
                    
                    <div className="relative z-10">
                      <div className="font-bold text-blue-400 mb-2 border-b border-neutral-800 pb-2 flex items-center gap-2">
                        <Bot size={16} />
                        {node.title}
                      </div>
                      <div className="text-sm text-neutral-200 leading-relaxed">
                        {exp.explanation}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>,
        gridContentElement
      )}
    </div>
  );
};
