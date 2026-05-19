<?php
/**
 * Module StockSync — PrestaShop 8.2
 *
 * Expose deux endpoints API propres pour la gestion des mouvements de stock :
 *   POST /module/stocksync/api   — ajuster le stock d'un produit
 *   POST /module/stocksync/ship  — expédier/livrer une commande (workflow complet)
 *
 * Authentification : clé webservice PrestaShop existante
 *   Header : X-Api-Key: <clé_webservice>
 *
 * Installation :
 *   1. Copier le dossier stocksync/ dans modules/ de votre PrestaShop
 *   2. Installer via Modules > Gestionnaire de modules
 */

declare(strict_types=1);

if (!defined('_PS_VERSION_')) {
    exit;
}

class Stocksync extends Module
{
    public function __construct()
    {
        $this->name             = 'stocksync';
        $this->tab              = 'others';
        $this->version          = '1.0.0';
        $this->author           = 'MyStore Dev';
        $this->need_instance    = 0;
        $this->ps_versions_compliancy = ['min' => '8.0.0', 'max' => _PS_VERSION_];
        $this->bootstrap        = true;

        parent::__construct();

        $this->displayName  = $this->l('Stock Sync API');
        $this->description  = $this->l(
            'Endpoints API propres pour les mouvements de stock PrestaShop ' .
            '(hooks natifs, stock_mvt, OrderHistory::changeIdOrderState).'
        );
    }

    public function install(): bool
    {
        return parent::install();
    }

    public function uninstall(): bool
    {
        return parent::uninstall();
    }

    /**
     * Page de configuration : affiche les URLs des endpoints.
     */
    public function getContent(): string
    {
        $base = Tools::getShopDomainSsl(true);

        return '
        <div class="panel">
            <h3>' . $this->l('Endpoints disponibles') . '</h3>
            <table class="table">
                <tr>
                    <td><code>POST</code></td>
                    <td><code>' . $base . '/module/stocksync/api</code></td>
                    <td>Mouvement de stock (increase / decrease / set)</td>
                </tr>
                <tr>
                    <td><code>POST</code></td>
                    <td><code>' . $base . '/module/stocksync/ship</code></td>
                    <td>Expédier une commande — workflow PS complet</td>
                </tr>
            </table>
            <h3>' . $this->l('Authentification') . '</h3>
            <p>Header : <code>X-Api-Key: &lt;votre_clé_webservice_PS&gt;</code></p>
            <p>Ou : <code>Authorization: Bearer &lt;votre_clé_webservice_PS&gt;</code></p>
        </div>';
    }
}
