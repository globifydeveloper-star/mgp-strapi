export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;
  return str.replace(/(<([^>]+)>)/gi, '').trim();
};

export const sanitizePayload = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(sanitizePayload);
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = sanitizePayload(obj[key]);
      }
    }
    return newObj;
  }
  if (typeof obj === 'string') return sanitizeString(obj);
  return obj;
};

export const validateStringLengths = (obj: any): boolean => {
  if (Array.isArray(obj)) return obj.every(validateStringLengths);
  if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!validateStringLengths(obj[key])) return false;
        if (typeof obj[key] === 'string') {
          const val = obj[key];
          const lowerKey = key.toLowerCase();
          // Adjust length limits based on field name conventions
          if (lowerKey.includes('message') || lowerKey.includes('details') || lowerKey.includes('address')) {
            if (val.length > 2000) return false;
          } else {
            // Standard length limit for other fields (name, email, city, etc.)
            // Allow up to 255 characters
            if (val.length > 255) return false;
          }
        }
      }
    }
    return true;
  }
  return true;
};
