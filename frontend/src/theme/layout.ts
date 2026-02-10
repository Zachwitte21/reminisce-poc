import { Dimensions, Platform } from 'react-native';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

export const layout = {
    window: {
        width: windowWidth,
        height: windowHeight,
    },
    isSmallDevice: windowWidth < 375,
    isTablet: windowWidth >= 768,
    isDesktop: windowWidth >= 1024,
    maxWidth: 800, // Updated to 800px per user request
    contentPadding: windowWidth > 800 ? 40 : 20,
};

/**
 * Returns a width that is at most the max width, centered.
 */
export const getResponsiveWidth = (percent: number = 100) => {
    const targetWidth = (windowWidth * percent) / 100;
    return Math.min(targetWidth, layout.maxWidth);
};

/**
 * Helper to determine current screen type
 */
export const getDeviceType = () => {
    if (windowWidth >= 1024) return 'desktop';
    if (windowWidth >= 768) return 'tablet';
    return 'phone';
};
