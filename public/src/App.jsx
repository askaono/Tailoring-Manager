import React, { useState, useEffect, useRef } from 'react';
import { Save, Upload, Plus, Trash2, Search, FileText, Download, RefreshCw, X, AlertTriangle } from 'lucide-react';

/**
 * XCCDF Tailoring Editor v2
 * Features:
 * - Parses XCCDF Tailoring XML files.
 * - Associations comments (names) with their respective rules.
 * - Edits 'select' (boolean) and 'set-value' (string).
 * - NEW: Edits 'refine-rule' (severity).
 * - Adds/Deletes rules.
 * - Exports valid XML with namespaces.
 */

// --- Initial Data ---
const INITIAL_XML = `<?xml version='1.0' encoding='UTF-8'?>
<Tailoring xmlns="http://checklists.nist.gov/xccdf/1.2" id="xccdf_scap-workbench_tailoring_default">
  <benchmark href="/usr/share/usg-benchmarks/ubuntu2204_CIS_1"/>
  <version time="2025-10-10T08:37:35+00:00">1</version>
  <Profile id="xccdf_org.ssgproject.content_profile_cis_level2_server_customized" extends="xccdf_org.ssgproject.content_profile_cis_level2_server">
    <title xmlns:xhtml="http://www.w3.org/1999/xhtml" xml:lang="en-US" override="true">CIS Ubuntu 22.04 Level 2 Server Benchmark [CUSTOMIZED]</title>
    <description xmlns:xhtml="http://www.w3.org/1999/xhtml" xml:lang="en-US" override="true">This baseline aligns to the Center for Internet Security Ubuntu 22.04 LTS Benchmark, v1.0.0, released 08-30-2022.</description>
    <!--1.1.1.1: Ensure mounting of cramfs filesystems is disabled (Automated)-->
    <select idref="xccdf_org.ssgproject.content_rule_kernel_module_cramfs_disabled" selected="true"/>
    <refine-rule idref="xccdf_org.ssgproject.content_rule_kernel_module_cramfs_disabled" severity="high"/>
    <!--1.1.1.2: Ensure mounting of squashfs filesystems is disabled (Automated)-->
    <select idref="xccdf_org.ssgproject.content_rule_kernel_module_squashfs_disabled" selected="true"/>
    <!--1.6.1.3: Ensure all AppArmor Profiles are in enforce or complain mode (Automated)-->
    <set-value idref="xccdf_org.ssgproject.content_value_var_apparmor_mode">enforce</set-value>
  </Profile>
</Tailoring>`;

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon }) => {
  const baseStyle = "flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-slate-400",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 focus:ring-red-400",
    success: "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500",
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const SeverityBadge = ({ severity }) => {
  const colors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-orange-100 text-orange-700 border-orange-200",
    low: "bg-yellow-100 text-yellow-700 border-yellow-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
    default: "bg-slate-100 text-slate-500 border-slate-200"
  };
  
  const display = severity === 'default' || !severity ? 'Default' : severity.charAt(0).toUpperCase() + severity.slice(1);
  const colorClass = colors[severity?.toLowerCase()] || colors.default;

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colorClass} uppercase`}>
      {display}
    </span>
  );
};

// --- Main Application ---

export default function App() {
  // State
  const [xmlContent, setXmlContent] = useState(INITIAL_XML);
  const [parsedData, setParsedData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Form State for Adding
  const [newRuleType, setNewRuleType] = useState('select'); // 'select' or 'set-value'
  const [newRuleId, setNewRuleId] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('true');
  const [newRuleSeverity, setNewRuleSeverity] = useState('default');
  const [newRuleComment, setNewRuleComment] = useState('');

  const fileInputRef = useRef(null);

  // --- Parser Logic ---
  
  const parseXML = (xmlString) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "application/xml");
      
      const parseError = doc.querySelector("parsererror");
      if (parseError) throw new Error("Invalid XML");

      // Extract Root Info
      const tailoring = doc.getElementsByTagName("Tailoring")[0];
      const benchmark = doc.getElementsByTagName("benchmark")[0]?.getAttribute("href") || "";
      const version = doc.getElementsByTagName("version")[0]?.textContent || "";
      
      // Extract Profile Info
      const profile = doc.getElementsByTagName("Profile")[0];
      if (!profile) throw new Error("No Profile found in XML");

      const profileId = profile.getAttribute("id");
      const profileExtends = profile.getAttribute("extends");
      
      const titleNode = profile.getElementsByTagName("title")[0] || profile.getElementsByTagNameNS("*", "title")[0];
      const descNode = profile.getElementsByTagName("description")[0] || profile.getElementsByTagNameNS("*", "description")[0];
      
      const profileTitle = titleNode ? titleNode.textContent : "Unknown Profile";
      const profileDesc = descNode ? descNode.textContent : "";

      // Parse Rules and Comments
      const itemsMap = new Map(); // Use Map to merge select/refine-rule
      const itemsOrder = []; // Keep track of order
      
      let lastComment = null;

      Array.from(profile.childNodes).forEach(node => {
        if (node.nodeType === Node.COMMENT_NODE) {
          lastComment = node.textContent.trim();
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName;
          const idref = node.getAttribute("idref");

          if (!idref) return; // Skip invalid nodes

          // Handle Select (Rule Selection)
          if (tagName === "select") {
            const uuid = Math.random().toString(36).substr(2, 9);
            const item = {
              uuid,
              type: 'select',
              idref,
              value: node.getAttribute("selected") || "false",
              severity: 'default', // Default severity
              comment: lastComment || ""
            };
            itemsMap.set(idref, item);
            itemsOrder.push(item);
            lastComment = null;
          } 
          // Handle Refine-Rule (Severity)
          else if (tagName === "refine-rule") {
            const severity = node.getAttribute("severity");
            if (itemsMap.has(idref)) {
              // Update existing item
              const existingItem = itemsMap.get(idref);
              existingItem.severity = severity;
            } else {
              // Create new item if refine-rule appears before select or alone
              const uuid = Math.random().toString(36).substr(2, 9);
              const item = {
                uuid,
                type: 'select', // Treat as rule even if only refined
                idref,
                value: 'default', // Indicates no explicit select tag yet
                severity: severity,
                comment: lastComment || ""
              };
              itemsMap.set(idref, item);
              itemsOrder.push(item);
            }
            lastComment = null;
          }
          // Handle Set-Value (Variables)
          else if (tagName === "set-value") {
             const uuid = Math.random().toString(36).substr(2, 9);
             const item = {
               uuid,
               type: 'set-value',
               idref,
               value: node.textContent,
               comment: lastComment || ""
             };
             itemsOrder.push(item);
             lastComment = null;
          }
        }
      });

      setParsedData({
        benchmark,
        version,
        profileId,
        profileExtends,
        profileTitle,
        profileDesc,
        items: itemsOrder
      });
      setNotification({ type: 'success', message: 'XML parsed successfully.' });
      setTimeout(() => setNotification(null), 3000);

    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: 'Failed to parse XML. Please check the file format.' });
    }
  };

  useEffect(() => {
    parseXML(xmlContent);
  }, []); 

  // --- Handlers ---

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setXmlContent(content);
      parseXML(content);
    };
    reader.readAsText(file);
  };

  const handleUpdateItem = (uuid, field, newValue) => {
    setParsedData(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.uuid === uuid ? { ...item, [field]: newValue } : item
      )
    }));
  };

  const handleDeleteItem = (uuid) => {
    if (window.confirm("Are you sure you want to delete this rule?")) {
      setParsedData(prev => ({
        ...prev,
        items: prev.items.filter(item => item.uuid !== uuid)
      }));
    }
  };

  const handleAddItem = () => {
    if (!newRuleId) {
      alert("Rule ID (idref) is required");
      return;
    }

    const newItem = {
      uuid: Math.random().toString(36).substr(2, 9),
      type: newRuleType,
      idref: newRuleId,
      value: newRuleValue,
      severity: newRuleType === 'select' ? newRuleSeverity : undefined,
      comment: newRuleComment
    };

    setParsedData(prev => ({
      ...prev,
      items: [newItem, ...prev.items] 
    }));

    setIsAddModalOpen(false);
    setNewRuleId('');
    setNewRuleComment('');
    setNewRuleSeverity('default');
    setNotification({ type: 'success', message: 'New rule added.' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = () => {
    if (!parsedData) return;
    
    let xml = `<?xml version='1.0' encoding='UTF-8'?>\n`;
    xml += `<Tailoring xmlns="http://checklists.nist.gov/xccdf/1.2" id="xccdf_scap-workbench_tailoring_default">\n`;
    xml += `  <benchmark href="${parsedData.benchmark}"/>\n`;
    xml += `  <version time="${new Date().toISOString()}">${parsedData.version}</version>\n`;
    xml += `  <Profile id="${parsedData.profileId}" extends="${parsedData.profileExtends}">\n`;
    xml += `    <title xmlns:xhtml="http://www.w3.org/1999/xhtml" xml:lang="en-US" override="true">${parsedData.profileTitle}</title>\n`;
    xml += `    <description xmlns:xhtml="http://www.w3.org/1999/xhtml" xml:lang="en-US" override="true">${parsedData.profileDesc}</description>\n`;
    
    parsedData.items.forEach(item => {
      if (item.comment) {
        xml += `    <!--${item.comment}-->\n`;
      }
      
      if (item.type === 'select') {
        // Only write select if value is not 'default' (meaning we have an explicit selection)
        // OR if we want to enforce inclusion. XCCDF usually requires explicit select.
        if (item.value !== 'default') {
             xml += `    <select idref="${item.idref}" selected="${item.value}"/>\n`;
        }
        // Write refine-rule if severity is not default
        if (item.severity && item.severity !== 'default') {
            xml += `    <refine-rule idref="${item.idref}" severity="${item.severity}"/>\n`;
        }
      } else if (item.type === 'set-value') {
        xml += `    <set-value idref="${item.idref}">${item.value}</set-value>\n`;
      }
    });

    xml += `  </Profile>\n`;
    xml += `</Tailoring>`;

    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tailoring_custom.xml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setNotification({ type: 'success', message: 'File downloaded successfully.' });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Filtering ---
  
  const filteredItems = parsedData?.items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.idref.toLowerCase().includes(searchLower) ||
      (item.comment && item.comment.toLowerCase().includes(searchLower))
    );
  }) || [];

  if (!parsedData) return <div className="p-8 text-center text-slate-500">Loading XML Parser...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-lg">
              <FileText size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">XCCDF Tailoring Editor</h1>
              <p className="text-xs text-slate-400">Edit CIS Benchmark Tailoring XMLs</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <input 
              type="file" 
              accept=".xml" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
            />
            <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
              Import XML
            </Button>
            <Button variant="success" icon={Download} onClick={handleExport}>
              Export XML
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        
        {notification && (
          <div className={`mb-4 p-4 rounded-md flex items-center gap-2 ${
            notification.type === 'error' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200'
          } border shadow-sm animate-in slide-in-from-top-2`}>
            {notification.type === 'error' ? <X size={18} /> : <Save size={18} />}
            {notification.message}
          </div>
        )}

        {/* Profile Meta Card */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">{parsedData.profileTitle}</h2>
              <p className="text-slate-500 text-sm">Base Profile ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{parsedData.profileExtends}</code></p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p>Benchmark: {parsedData.benchmark}</p>
              <p>Version: {parsedData.version}</p>
            </div>
          </div>
          <p className="text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-100">
            {parsedData.profileDesc}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search rules by ID or description..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Button icon={Plus} onClick={() => setIsAddModalOpen(true)}>
            Add New Rule
          </Button>
        </div>

        {/* Rules List */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 bg-slate-100 p-4 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">Type</div>
            <div className="col-span-6">Rule Description & ID</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-2">Value</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No rules found matching your search.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.uuid} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors gap-4">
                  
                  {/* Type Badge */}
                  <div className="col-span-1 flex justify-center">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                      item.type === 'select' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {item.type === 'select' ? 'Rule' : 'Var'}
                    </span>
                  </div>

                  {/* Description & ID */}
                  <div className="col-span-6 overflow-hidden">
                    <input 
                      type="text" 
                      className="w-full font-medium text-slate-800 bg-transparent border-none p-0 focus:ring-0 mb-1 truncate placeholder-slate-400"
                      value={item.comment}
                      onChange={(e) => handleUpdateItem(item.uuid, 'comment', e.target.value)}
                      placeholder="No description (Add a comment)"
                    />
                    <div className="text-xs text-slate-500 font-mono truncate" title={item.idref}>
                      {item.idref}
                    </div>
                  </div>

                   {/* Severity Selector (Only for Rules) */}
                   <div className="col-span-2">
                    {item.type === 'select' ? (
                       <div className="flex items-center">
                         <select
                           value={item.severity || 'default'}
                           onChange={(e) => handleUpdateItem(item.uuid, 'severity', e.target.value)}
                           className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-100 outline-none w-full cursor-pointer"
                         >
                           <option value="default">Default</option>
                           <option value="high">High</option>
                           <option value="medium">Medium</option>
                           <option value="low">Low</option>
                           <option value="info">Info</option>
                         </select>
                         <div className="ml-2">
                            <SeverityBadge severity={item.severity} />
                         </div>
                       </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">N/A</span>
                    )}
                   </div>

                  {/* Value Editor */}
                  <div className="col-span-2">
                    {item.type === 'select' ? (
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={item.value === 'true'}
                            onChange={(e) => handleUpdateItem(item.uuid, 'value', e.target.checked ? 'true' : 'false')}
                          />
                          <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                        <span className="text-xs font-medium text-slate-600 w-12">
                          {item.value === 'true' ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={item.value}
                        onChange={(e) => handleUpdateItem(item.uuid, 'value', e.target.value)}
                      />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex justify-end">
                    <button 
                      onClick={() => handleDeleteItem(item.uuid)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Rule Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Tailoring Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rule Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="ruleType" 
                  value="select" 
                  checked={newRuleType === 'select'}
                  onChange={(e) => setNewRuleType(e.target.value)}
                  className="mr-2"
                />
                Rule (Select/Refine)
              </label>
              <label className="flex items-center">
                <input 
                  type="radio" 
                  name="ruleType" 
                  value="set-value" 
                  checked={newRuleType === 'set-value'}
                  onChange={(e) => {
                    setNewRuleType(e.target.value);
                    setNewRuleValue(''); // Clear boolean default
                  }}
                  className="mr-2"
                />
                Variable (Set Value)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">XCCDF ID Reference</label>
            <input 
              type="text" 
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
              placeholder="xccdf_org.ssgproject.content_rule_..."
              value={newRuleId}
              onChange={(e) => setNewRuleId(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (Comment)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              placeholder="e.g. 1.1.1 Ensure mounting of cramfs is disabled"
              value={newRuleComment}
              onChange={(e) => setNewRuleComment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              {newRuleType === 'select' ? (
                <select 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(e.target.value)}
                >
                  <option value="true">True (Selected)</option>
                  <option value="false">False (Unselected)</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Value..."
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(e.target.value)}
                />
              )}
            </div>

            {newRuleType === 'select' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Severity</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newRuleSeverity}
                  onChange={(e) => setNewRuleSeverity(e.target.value)}
                >
                  <option value="default">Default</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddItem}>Add Rule</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
