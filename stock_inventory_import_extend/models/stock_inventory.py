# -*- coding: utf-8 -*-
# (c) 2015 Oihane Crucelaegui - AvanzOSC
# License AGPL-3 - See http://www.gnu.org/licenses/agpl-3.0.html

from openerp import models, fields, api, exceptions, _

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

class ImportInventory(models.TransientModel):
    _inherit = 'import.inventory'

    @api.one
    def action_import(self):
        #No considera la fecha en el nombre del inventario y mantiene el nombre dado inicialmente al inventario y añade el nombre del archivo
        ctx = self._context
        inventory_obj = self.env['stock.inventory']
        if 'active_id' in ctx:
            inventory = inventory_obj.browse(ctx['active_id'])
        inv_name = inventory.name + ': ' + self.name
        result = super(ImportInventory, self).action_import()
        if inventory:
            inventory.write({'name': inv_name})
        return result