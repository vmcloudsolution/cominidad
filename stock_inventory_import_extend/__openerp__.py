# -*- encoding: utf-8 -*-
##############################################################################
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published
#    by the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see http://www.gnu.org/licenses/.
#
##############################################################################
{
    "name": "Extend Stock Inventory Import from CSV file",
    "version": "8.0.1.0.0",
    "category": "Generic Modules",
    'description': """
        Instalar:
        sudo pip install pandas
    """,
    "author": "VMCLOUD SOLUTION",
    "website": "",
    "depends": [
        "stock_inventory_import",
    ],
    "data": [
        "views/inventory_view.xml",
    ],
    "installable": True,
}
