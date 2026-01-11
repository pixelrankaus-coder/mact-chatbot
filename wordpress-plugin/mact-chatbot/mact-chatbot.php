<?php
/**
 * Plugin Name: MACt Chatbot
 * Plugin URI: https://mact.au
 * Description: AI-powered chatbot widget for your website.
 * Version: 1.0.0
 * Author: MACt
 * Author URI: https://mact.au
 * License: GPL v2 or later
 * Text Domain: mact-chatbot
 */

if (!defined('ABSPATH')) {
    exit;
}

// Add settings menu
add_action('admin_menu', 'mact_chatbot_menu');

function mact_chatbot_menu() {
    add_options_page(
        'MACt Chatbot',
        'MACt Chatbot',
        'manage_options',
        'mact-chatbot',
        'mact_chatbot_settings_page'
    );
}

// Register settings
add_action('admin_init', 'mact_chatbot_register_settings');

function mact_chatbot_register_settings() {
    register_setting('mact_chatbot_settings', 'mact_widget_url');
    register_setting('mact_chatbot_settings', 'mact_store_id');
    register_setting('mact_chatbot_settings', 'mact_enabled');
}

// Settings page HTML
function mact_chatbot_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $widget_url = get_option('mact_widget_url', '');
    $store_id = get_option('mact_store_id', 'mact-store-001');
    $enabled = get_option('mact_enabled', '0');
    ?>
    <div class="wrap">
        <h1>MACt Chatbot Settings</h1>

        <div style="background: #fff; padding: 20px; border: 1px solid #ccc; margin: 20px 0; border-radius: 4px;">
            <?php if ($enabled === '1' && !empty($widget_url)): ?>
                <p style="color: green; font-weight: bold;">✓ Chatbot is Active</p>
            <?php elseif (!empty($widget_url)): ?>
                <p style="color: orange; font-weight: bold;">⏸ Chatbot is Disabled</p>
            <?php else: ?>
                <p style="color: red; font-weight: bold;">⚠ Please enter your Widget URL</p>
            <?php endif; ?>
        </div>

        <form method="post" action="options.php">
            <?php settings_fields('mact_chatbot_settings'); ?>

            <table class="form-table">
                <tr>
                    <th scope="row"><label for="mact_widget_url">Widget URL</label></th>
                    <td>
                        <input type="url" id="mact_widget_url" name="mact_widget_url"
                               value="<?php echo esc_attr($widget_url); ?>"
                               class="regular-text"
                               placeholder="https://your-app.vercel.app">
                        <p class="description">Your MACt chatbot URL (e.g., https://your-app.vercel.app)</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="mact_store_id">Store ID</label></th>
                    <td>
                        <input type="text" id="mact_store_id" name="mact_store_id"
                               value="<?php echo esc_attr($store_id); ?>"
                               class="regular-text"
                               placeholder="mact-store-001">
                        <p class="description">Your unique store identifier</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Enable Chatbot</th>
                    <td>
                        <label>
                            <input type="checkbox" name="mact_enabled" value="1"
                                   <?php checked($enabled, '1'); ?>>
                            Show chatbot widget on your site
                        </label>
                    </td>
                </tr>
            </table>

            <?php submit_button('Save Settings'); ?>
        </form>
    </div>
    <?php
}

// Add widget script to frontend
add_action('wp_footer', 'mact_chatbot_add_widget');

function mact_chatbot_add_widget() {
    if (is_admin()) {
        return;
    }

    $enabled = get_option('mact_enabled', '0');
    $widget_url = get_option('mact_widget_url', '');
    $store_id = get_option('mact_store_id', 'mact-store-001');

    if ($enabled !== '1' || empty($widget_url)) {
        return;
    }

    $widget_url = rtrim($widget_url, '/');
    ?>
    <!-- MACt Chatbot Widget -->
    <script src="<?php echo esc_url($widget_url); ?>/widget/chat-widget.js"
            data-store-id="<?php echo esc_attr($store_id); ?>"
            data-api-base="<?php echo esc_url($widget_url); ?>"
            defer></script>
    <?php
}
