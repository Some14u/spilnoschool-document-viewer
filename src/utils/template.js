const fs = require('fs');
const path = require('path');

class TemplateEngine {
  constructor(templatesDir = path.join(__dirname, '..', 'templates')) {
    this.templatesDir = templatesDir;
    this.templateCache = new Map();
  }

  loadTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(this.templatesDir, templateName);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    this.templateCache.set(templateName, templateContent);
    
    return templateContent;
  }

  render(templateName, variables = {}) {
    const template = this.loadTemplate(templateName);
    
    return this.processTemplate(template, variables);
  }

  processTemplate(template, variables) {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, this.escapeHtml(String(value)));
    }
    
    const unreplacedVars = result.match(/\{\{[^}]+\}\}/g);
    if (unreplacedVars) {
      console.warn('⚠️ Template contains unreplaced variables:', unreplacedVars);
    }
    
    return result;
  }

  escapeHtml(text) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
  }

  clearCache() {
    this.templateCache.clear();
  }
}

const templateEngine = new TemplateEngine();

module.exports = {
  TemplateEngine,
  render: (templateName, variables) => templateEngine.render(templateName, variables),
  clearCache: () => templateEngine.clearCache()
};
