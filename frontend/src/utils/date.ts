/**
 * Formats a raw numeric string into MM / DD / YYYY
 */
export const formatBirthdayInput = (text: string): string => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (digits.length > 0) {
        formatted = digits.slice(0, 2);
        if (digits.length > 2) {
            formatted += ' / ' + digits.slice(2, 4);
            if (digits.length > 4) {
                formatted += ' / ' + digits.slice(4, 8);
            }
        }
    }
    return formatted;
};

/**
 * Converts MM / DD / YYYY to YYYY-MM-DD
 */
export const birthdayToISO = (formatted: string): string | undefined => {
    const digits = formatted.replace(/\D/g, '');
    if (digits.length !== 8) return undefined;

    const month = digits.slice(0, 2);
    const day = digits.slice(2, 4);
    const year = digits.slice(4, 8);

    return `${year}-${month}-${day}`;
};

/**
 * Converts YYYY-MM-DD to MM / DD / YYYY
 */
export const isoToBirthday = (iso: string): string => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${month} / ${day} / ${year}`;
};

/**
 * Converts YYYY-MM-DD to a "Long" display format (e.g., December 15, 2002)
 * without timezone shifts.
 */
export const formatDisplayDate = (iso: string): string => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return '';
    const [year, month, day] = parts;

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthName = months[parseInt(month, 10) - 1];
    const dayNum = parseInt(day, 10);

    return `${monthName} ${dayNum}, ${year}`;
};
