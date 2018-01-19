# -*- coding: utf-8 -*-
# (c) 2015 Oihane Crucelaegui - AvanzOSC
# License AGPL-3 - See http://www.gnu.org/licenses/agpl-3.0.html

from openerp import models, fields, api, exceptions, _

class StockInventory(models.Model):
    _inherit = "stock.inventory"

    user_id = fields.Many2one('res.users', string="Responsable", readonly=True, states={'draft': [('readonly', False)], 'confirm': [('readonly', False)]})
    fecha_toma = fields.Datetime('Fecha de conteo', readonly=True, states={'draft': [('readonly', False)], 'confirm': [('readonly', False)]}, default=fields.Datetime.now, help='Fecha que se realizó el conteo de los productos')

    @api.multi
    def process_import_lines(self):
        """Procesa nuevamente los productos no encontrados y los busca por nombre del producto"""
        super(StockInventory, self).process_import_lines()
        import_lines = self.mapped('import_lines')#Hacia abajo la misma logica
        inventory_line_obj = self.env['stock.inventory.line']
        product_obj = self.env['product.product']
        for line in import_lines:
            if line.fail:
                if not line.product:
                    prod_lst = product_obj.search([('name', '=',
                                                    line.code)])
                    if prod_lst and len(prod_lst) == 1:#Solo debe existir uno
                        product = prod_lst[0]
                    else:
                        line.fail_reason = _('No product code found')
                        continue
                else:
                    product = line.product
                lot_id = None
                inventory_line_obj.create({
                    'product_id': product.id,
                    'product_uom_id': product.uom_id.id,
                    'product_qty': line.quantity,
                    'inventory_id': line.inventory_id.id,
                    'location_id': line.location_id.id,
                    'prod_lot_id': lot_id})
                line.write({'fail': False, 'fail_reason': _('Processed')})
        return True


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
    def _convert_csv_to_xls(self):
        import os
        import tempfile
        import base64
        import pandas as pd

        #Crea temporales
        fxls, xls_fname = tempfile.mkstemp()
        fcsv, csv_fname = tempfile.mkstemp(suffix='.csv')
        #Excribe los datos del archivo Excel
        os.write(fxls, base64.b64decode(self.data))
        os.close(fxls)
        #Converte de Excel a CSV
        try:
            pd.read_excel(xls_fname).to_csv(csv_fname, index=False)
        except:
            raise exceptions.Warning("Error al convertir internamente de Excel a CSV")
        #Lee el archivo CSV
        file_csv = open(csv_fname, 'r+')
        data_csv = base64.b64encode(file_csv.read())
        self.data = data_csv
        #Elimina temporales
        os.unlink(xls_fname)
        os.unlink(csv_fname)

    @api.one
    def action_import(self):
        """Si es un archivo XLS lo convierte en CSV"""
        self._convert_csv_to_xls()
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