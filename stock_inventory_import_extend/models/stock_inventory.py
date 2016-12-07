# -*- coding: utf-8 -*-
# (c) 2015 Oihane Crucelaegui - AvanzOSC
# License AGPL-3 - See http://www.gnu.org/licenses/agpl-3.0.html

from openerp import models, fields, api, exceptions, _, osv

class StockInventory(models.Model):
    _inherit = "stock.inventory"

    @api.multi
    def action_done(self):
        for inventory in self:
            for iml in inventory.import_lines:
                if iml.fail:
                    raise exceptions.Warning('Verifique!',
                                             "\nExiste un producto con fallo en la importación. Revise los productos resaltados de color Rojo.\n\n Realice la corrección y vuelva a presionar el boton 'Procesar las lineas del archivo'. Si no desea incluir dicho producto eliminelo de la lista de 'Lineas importadas'")
        return super(StockInventory, self).action_done()