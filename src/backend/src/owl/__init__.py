"""OWL ontology parsing and generation utilities.

Extracted from OntoBricks (https://github.com/larsgeorge/ontobricks).
Provides Turtle/RDF-XML ↔ Python dict round-tripping via rdflib.
"""

from src.owl.owl_parser import OntologyParser, TaxonomyParser
from src.owl.owl_generator import OntologyGenerator

__all__ = ["OntologyParser", "TaxonomyParser", "OntologyGenerator"]
