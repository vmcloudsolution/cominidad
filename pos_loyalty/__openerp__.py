# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################



{
    'name': 'POS Loyalty & Gift System',
    'version': '1.5',
    'summary': 'Point system for POS, Bonus, Loyalty, POS Gift, Point of sale Bonus, POS Bonus, POS point, POS Loyalty',
    'description': """

=======================

This module allows you to define a loyalty program in
the point of sale, where the customers earn loyalty points
and get rewards. Contact and support email: almas@dusal.net

""",
    'author' : 'Dusal Solutions,Tiny SPRL ',
    'category': 'Point of Sale',
    'license': 'AGPL-3',
    'sequence': 1,
    #'website' : 'http://serelt.com',
    'price': 24.99, 
    'currency': 'EUR',
    'depends': ['point_of_sale', 'pos_etiquetera'],
    'images': [
        'static/images/main_screenshot.png', 'static/images/screenshot_main.png', 
        'static/images/screenshot0.png', 'static/images/screenshot01.png', 'static/images/screenshot02.png', 'static/images/screenshot03.png', 'static/images/screenshot04.png', 'static/images/screenshot05.png',
    ],
    'data': [
        'views/views.xml',
        'security/ir.model.access.csv',
        'views/templates.xml'
    ],
    'qweb': ['static/src/xml/loyalty.xml'],
    'installable': True,
    'auto_install': False,
}

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
